import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  StoreStatus,
  TransactionType,
  UserRole,
  ZoneType,
} from '@prisma/client';
import { ORDER_TRANSITIONS } from '@delivery/shared';
import { Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ORDERS_QUEUE } from '../../redis/redis.module';
import { JwtPayload } from '../auth/jwt-payload.interface';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from '../payments/payment-gateway.interface';
import { isOpenAt, OpeningInterval } from '../stores/opening-hours';
import { haversineKm } from './distance';
import { CreateOrderDto } from './dto/orders.dto';
import { OrdersGateway } from './orders.gateway';

/** Aritmética de dinheiro em centavos inteiros — nunca floats acumulados. */
const toCents = (v: number | Prisma.Decimal) => Math.round(Number(v) * 100);
const toReais = (cents: number) => cents / 100;

const ORDER_INCLUDE = {
  items: { include: { options: true } },
  store: { select: { id: true, name: true, slug: true, ownerId: true } },
  address: true,
  customer: { select: { id: true, name: true, phone: true } },
  review: true,
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
    @Inject(ORDERS_QUEUE) private readonly queue: Queue,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway,
  ) {}

  // ============================ CHECKOUT ============================

  async create(user: JwtPayload, dto: CreateOrderDto) {
    if (dto.paymentMethod === PaymentMethod.CARD_ONLINE) {
      throw new UnprocessableEntityException(
        'Cartão online estará disponível em breve — use Pix ou pagamento na entrega',
      );
    }

    const store = await this.prisma.store.findFirst({
      where: { id: dto.storeId, status: StoreStatus.ACTIVE },
      include: { deliveryZones: true },
    });
    if (!store) throw new UnprocessableEntityException('Loja indisponível no momento');
    if (!isOpenAt(store.openingHours as unknown as OpeningInterval[], new Date())) {
      throw new UnprocessableEntityException('A loja está fechada agora');
    }

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId: user.sub },
    });
    if (!address) throw new NotFoundException('Endereço não encontrado');
    if (address.cityId !== store.cityId) {
      throw new UnprocessableEntityException('O endereço não é da cidade desta loja');
    }

    const deliveryFeeCents = this.resolveDeliveryFee(store, address);

    // Recalcula TUDO pelo banco — nunca confiar em preços vindos do front
    const items = await this.buildItems(store.id, dto.items);
    const subtotalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

    if (subtotalCents < toCents(store.minOrderValue)) {
      throw new UnprocessableEntityException(
        `O pedido mínimo desta loja é R$ ${Number(store.minOrderValue).toFixed(2)}`,
      );
    }

    const totalCents = subtotalCents + deliveryFeeCents;
    if (dto.changeFor !== undefined && toCents(dto.changeFor) < totalCents) {
      throw new UnprocessableEntityException('O troco deve ser maior que o total do pedido');
    }

    const order = await this.prisma.order.create({
      data: {
        customerId: user.sub,
        storeId: store.id,
        addressId: address.id,
        status: OrderStatus.CREATED,
        paymentMethod: dto.paymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        changeFor: dto.changeFor,
        customerNote: dto.customerNote,
        subtotal: toReais(subtotalCents),
        deliveryFee: toReais(deliveryFeeCents),
        discount: 0,
        total: toReais(totalCents),
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            unitPrice: toReais(i.unitPriceCents),
            quantity: i.quantity,
            note: i.note,
            options: {
              create: i.options.map((o) => ({
                optionId: o.optionId,
                name: o.name,
                extraPrice: toReais(o.extraPriceCents),
              })),
            },
          })),
        },
      },
      include: ORDER_INCLUDE,
    });

    if (dto.paymentMethod === PaymentMethod.PIX) {
      // Pix: cobra primeiro; o lojista SÓ vê o pedido após a confirmação
      // (webhook → markPixPaid). Se não pagar no prazo, o job pix-expire cancela.
      const expiresInSeconds = Math.floor(
        Number(process.env.PIX_EXPIRE_MS ?? 15 * 60_000) / 1000,
      );
      const charge = await this.paymentGateway.createPixCharge({
        orderId: order.id,
        orderNumber: order.number,
        amountCents: totalCents,
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        expiresInSeconds,
      });
      const withPix = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          gatewayChargeId: charge.chargeId,
          pixCopiaECola: charge.copiaECola,
          pixExpiresAt: charge.expiresAt,
        },
        include: ORDER_INCLUDE,
      });
      await this.queue.add(
        'pix-expire',
        { orderId: order.id },
        { delay: expiresInSeconds * 1000, jobId: `pix-${order.id}` },
      );
      return withPix;
    }

    // Pagamento na entrega: pedido vai direto para o lojista
    this.gateway.emitOrderCreated(store.id, order);
    await this.scheduleAcceptTimeouts(order.id);

    return order;
  }

  // ============================ PIX ============================

  /**
   * Confirmação de pagamento (webhook). IDEMPOTENTE: o update só acontece se
   * o pagamento ainda está PENDING — evento duplicado não tem efeito.
   */
  async markPixPaid(chargeId: string): Promise<boolean> {
    const updated = await this.prisma.order.updateMany({
      where: {
        gatewayChargeId: chargeId,
        paymentMethod: PaymentMethod.PIX,
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.CREATED,
      },
      data: { paymentStatus: PaymentStatus.PAID },
    });
    if (updated.count === 0) return false; // já processado ou pedido cancelado

    const order = await this.prisma.order.findFirstOrThrow({
      where: { gatewayChargeId: chargeId },
      include: ORDER_INCLUDE,
    });

    // Agora sim o pedido "nasce" para o lojista
    this.gateway.emitOrderCreated(order.storeId, order);
    this.gateway.emitPaymentConfirmed(order.customerId, order.id);
    await this.scheduleAcceptTimeouts(order.id);
    const pixJob = await this.queue.getJob(`pix-${order.id}`);
    if (pixJob) await pixJob.remove().catch(() => undefined);

    return true;
  }

  /** Eco de estorno vindo do gateway (idempotente). */
  async markPixRefunded(chargeId: string): Promise<void> {
    await this.prisma.order.updateMany({
      where: { gatewayChargeId: chargeId, paymentStatus: PaymentStatus.PAID },
      data: { paymentStatus: PaymentStatus.REFUNDED },
    });
  }

  /** Chamado pelo worker: Pix não pago no prazo → cancela o pedido. */
  async handlePixExpire(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (
      !order ||
      order.paymentMethod !== PaymentMethod.PIX ||
      order.paymentStatus !== PaymentStatus.PENDING ||
      order.status !== OrderStatus.CREATED
    ) {
      return;
    }
    await this.prisma.order.update({
      where: { id: orderId, status: OrderStatus.CREATED },
      data: {
        status: OrderStatus.CANCELED,
        canceledAt: new Date(),
        canceledBy: UserRole.ADMIN,
        cancelReason: 'Pagamento não confirmado a tempo',
        paymentStatus: PaymentStatus.FAILED,
      },
    });
    // só o cliente precisa saber — o lojista nunca viu este pedido
    this.gateway.emitStatusChanged({
      orderId: order.id,
      storeId: order.storeId,
      customerId: order.customerId,
      status: OrderStatus.CANCELED,
    });
  }

  /** Taxa de entrega: bairro exato ou raio (haversine). Mais barata vence. */
  private resolveDeliveryFee(
    store: {
      lat: number | null;
      lng: number | null;
      deliveryZones: {
        type: ZoneType;
        neighborhood: string | null;
        radiusKm: number | null;
        fee: Prisma.Decimal;
      }[];
    },
    address: { neighborhood: string; lat: number | null; lng: number | null },
  ): number {
    const candidates: number[] = [];
    for (const zone of store.deliveryZones) {
      if (
        zone.type === ZoneType.NEIGHBORHOOD &&
        zone.neighborhood?.trim().toLowerCase() === address.neighborhood.trim().toLowerCase()
      ) {
        candidates.push(toCents(zone.fee));
      }
      if (
        zone.type === ZoneType.RADIUS &&
        zone.radiusKm != null &&
        store.lat != null &&
        store.lng != null &&
        address.lat != null &&
        address.lng != null &&
        haversineKm(store.lat, store.lng, address.lat, address.lng) <= zone.radiusKm
      ) {
        candidates.push(toCents(zone.fee));
      }
    }
    if (candidates.length === 0) {
      throw new UnprocessableEntityException('Este endereço está fora da área de entrega');
    }
    return Math.min(...candidates);
  }

  /** Valida itens/opções contra o banco e monta os snapshots. */
  private async buildItems(
    storeId: string,
    inputs: CreateOrderDto['items'],
  ): Promise<
    {
      productId: string;
      name: string;
      unitPriceCents: number;
      quantity: number;
      note?: string;
      options: { optionId: string; name: string; extraPriceCents: number }[];
    }[]
  > {
    const products = await this.prisma.product.findMany({
      where: { id: { in: inputs.map((i) => i.productId) }, storeId },
      include: { optionGroups: { include: { options: true } } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return inputs.map((input) => {
      const product = byId.get(input.productId);
      if (!product) {
        throw new UnprocessableEntityException('Produto não encontrado nesta loja');
      }
      if (!product.available) {
        throw new UnprocessableEntityException(`"${product.name}" está esgotado`);
      }

      const chosenIds = new Set(input.optionIds ?? []);
      const options: { optionId: string; name: string; extraPriceCents: number }[] = [];
      let extrasCents = 0;

      for (const group of product.optionGroups) {
        const chosen = group.options.filter((o) => chosenIds.has(o.id));
        const unavailable = chosen.find((o) => !o.available);
        if (unavailable) {
          throw new UnprocessableEntityException(`Opção "${unavailable.name}" está esgotada`);
        }
        if (chosen.length < group.minSelect) {
          throw new UnprocessableEntityException(
            `Escolha pelo menos ${group.minSelect} em "${group.name}" (${product.name})`,
          );
        }
        if (chosen.length > group.maxSelect) {
          throw new UnprocessableEntityException(
            `Escolha no máximo ${group.maxSelect} em "${group.name}" (${product.name})`,
          );
        }
        for (const o of chosen) {
          options.push({ optionId: o.id, name: o.name, extraPriceCents: toCents(o.extraPrice) });
          extrasCents += toCents(o.extraPrice);
          chosenIds.delete(o.id);
        }
      }
      // Sobrou id que não pertence a nenhum grupo deste produto
      if (chosenIds.size > 0) {
        throw new UnprocessableEntityException(
          `Opção inválida para o produto "${product.name}"`,
        );
      }

      return {
        productId: product.id,
        name: product.name,
        unitPriceCents: toCents(product.price) + extrasCents,
        quantity: input.quantity,
        note: input.note,
        options,
      };
    });
  }

  // ======================= MÁQUINA DE ESTADOS =======================

  /**
   * ÚNICO caminho para mudar status de pedido. Valida a transição
   * (ORDER_TRANSITIONS), o ator, grava o timestamp e emite o evento
   * em tempo real após o commit.
   */
  async transition(
    orderId: string,
    to: OrderStatus,
    actor: JwtPayload,
    cancelReason?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { store: { select: { id: true, ownerId: true, commissionPct: true } } },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    // Enums do Prisma e do shared têm os MESMOS valores string; a comparação
    // é feita por valor para evitar conflito nominal de tipos
    const allowed: readonly string[] =
      ORDER_TRANSITIONS[order.status as keyof typeof ORDER_TRANSITIONS] ?? [];
    if (!allowed.includes(to)) {
      throw new ConflictException(
        `Não é possível mudar o pedido de ${order.status} para ${to}`,
      );
    }
    // Pedido Pix ainda não pago não pode ser aceito
    if (
      to === OrderStatus.ACCEPTED &&
      order.paymentMethod === PaymentMethod.PIX &&
      order.paymentStatus !== PaymentStatus.PAID
    ) {
      throw new ConflictException('Aguardando a confirmação do pagamento');
    }
    this.assertActor(order, to, actor);

    const timestamps: Prisma.OrderUpdateInput = {
      [OrderStatus.ACCEPTED]: { acceptedAt: new Date() },
      [OrderStatus.PREPARING]: {},
      [OrderStatus.READY]: { readyAt: new Date() },
      [OrderStatus.OUT_FOR_DELIVERY]: { outForDeliveryAt: new Date() },
      [OrderStatus.DELIVERED]: { deliveredAt: new Date() },
      [OrderStatus.CANCELED]: {
        canceledAt: new Date(),
        cancelReason,
        canceledBy: actor.role,
      },
      [OrderStatus.CREATED]: {},
    }[to];

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id: orderId, status: order.status }, // otimista: falha se mudou no meio
        data: {
          status: to,
          ...timestamps,
          // Pagamento na entrega é quitado quando o pedido é entregue
          ...(to === OrderStatus.DELIVERED &&
          order.paymentMethod === PaymentMethod.ON_DELIVERY
            ? { paymentStatus: PaymentStatus.PAID }
            : {}),
        },
        include: ORDER_INCLUDE,
      });

      if (to === OrderStatus.DELIVERED) {
        await this.settle(tx, result.id, order.storeId, order.store.commissionPct);
      }
      return result;
    });

    // Pós-commit
    this.gateway.emitStatusChanged({
      orderId: updated.id,
      storeId: order.storeId,
      customerId: order.customerId,
      status: to,
    });
    if (to === OrderStatus.ACCEPTED || to === OrderStatus.CANCELED) {
      await this.clearAcceptTimeouts(orderId);
    }

    // Cancelou um Pix PAGO → estorno automático
    if (
      to === OrderStatus.CANCELED &&
      order.paymentMethod === PaymentMethod.PIX &&
      order.paymentStatus === PaymentStatus.PAID &&
      order.gatewayChargeId
    ) {
      try {
        await this.paymentGateway.refund(order.gatewayChargeId);
        await this.prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: PaymentStatus.REFUNDED },
        });
      } catch (err) {
        // TODO: fila de retry de estornos + alerta no admin
        this.logger.error(
          `Estorno do pedido ${orderId} falhou — intervenção manual necessária`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
    // Cancelou um Pix ainda não pago → remove o job de expiração
    if (to === OrderStatus.CANCELED && order.paymentMethod === PaymentMethod.PIX) {
      const pixJob = await this.queue.getJob(`pix-${orderId}`);
      if (pixJob) await pixJob.remove().catch(() => undefined);
    }

    return updated;
  }

  /** Quem pode fazer cada transição. */
  private assertActor(
    order: { customerId: string; status: OrderStatus; store: { ownerId: string } },
    to: OrderStatus,
    actor: JwtPayload,
  ) {
    if (actor.role === UserRole.ADMIN) return;

    const isStoreOwner =
      actor.role === UserRole.STORE_OWNER && order.store.ownerId === actor.sub;
    const isCustomer = actor.role === UserRole.CUSTOMER && order.customerId === actor.sub;

    if (to === OrderStatus.CANCELED) {
      // Cliente: só antes do aceite. Lojista: antes de sair para entrega.
      if (isCustomer && order.status === OrderStatus.CREATED) return;
      if (isStoreOwner && order.status !== OrderStatus.OUT_FOR_DELIVERY) return;
      throw new ForbiddenException(
        isCustomer
          ? 'O pedido já foi aceito — fale com a loja para cancelar'
          : 'Você não pode cancelar este pedido',
      );
    }

    // Demais transições: só o lojista dono (ou admin, já retornado acima)
    if (!isStoreOwner) {
      throw new ForbiddenException('Você não pode alterar este pedido');
    }
  }

  /** Liquidação: venda credita o lojista, comissão debita — mesma transação. */
  private async settle(
    tx: Prisma.TransactionClient,
    orderId: string,
    storeId: string,
    commissionPct: Prisma.Decimal,
  ) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { storeId } });

    const saleCents = toCents(order.subtotal);
    const commissionCents = Math.round((saleCents * Number(commissionPct)) / 100);

    await tx.transaction.createMany({
      data: [
        {
          walletId: wallet.id,
          orderId,
          type: TransactionType.SALE,
          status: 'SETTLED',
          amount: toReais(saleCents),
          note: `Venda do pedido #${order.number}`,
        },
        {
          walletId: wallet.id,
          orderId,
          type: TransactionType.COMMISSION,
          status: 'SETTLED',
          amount: -toReais(commissionCents),
          note: `Comissão da plataforma (${Number(commissionPct)}%)`,
        },
      ],
    });
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: toReais(saleCents - commissionCents) } },
    });
  }

  // ========================= TIMEOUTS (BullMQ) =========================

  private async scheduleAcceptTimeouts(orderId: string) {
    const warnMs = Number(process.env.ORDER_ACCEPT_WARN_MS ?? 5 * 60_000);
    const cancelMs = Number(process.env.ORDER_ACCEPT_CANCEL_MS ?? 10 * 60_000);
    // jobId não pode conter ":" (restrição do BullMQ)
    await this.queue.add('accept-warn', { orderId }, { delay: warnMs, jobId: `warn-${orderId}` });
    await this.queue.add(
      'accept-cancel',
      { orderId },
      { delay: cancelMs, jobId: `cancel-${orderId}` },
    );
  }

  private async clearAcceptTimeouts(orderId: string) {
    for (const jobId of [`warn-${orderId}`, `cancel-${orderId}`]) {
      const job = await this.queue.getJob(jobId);
      if (job) await job.remove().catch(() => undefined);
    }
  }

  /** Chamado pelo worker: avisa o admin se o pedido continua sem aceite. */
  async handleAcceptWarn(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order?.status === OrderStatus.CREATED) {
      this.gateway.emitOrderStuck({
        id: order.id,
        number: order.number,
        storeId: order.storeId,
      });
    }
  }

  /** Chamado pelo worker: cancela de vez se o lojista nunca respondeu. */
  async handleAcceptCancel(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order?.status !== OrderStatus.CREATED) return;

    await this.prisma.order.update({
      where: { id: orderId, status: OrderStatus.CREATED },
      data: {
        status: OrderStatus.CANCELED,
        canceledAt: new Date(),
        canceledBy: UserRole.ADMIN,
        cancelReason: 'A loja não respondeu a tempo',
        // TODO Etapa 7: estorno automático quando houver pagamento online
      },
    });
    this.gateway.emitStatusChanged({
      orderId: order.id,
      storeId: order.storeId,
      customerId: order.customerId,
      status: OrderStatus.CANCELED,
    });
  }

  // ============================ AVALIAÇÕES ============================

  /** Cliente avalia o pedido entregue (uma vez). Atualiza o agregado da loja. */
  async review(
    orderId: string,
    user: JwtPayload,
    dto: { storeRating: number; courierRating?: number; comment?: string },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: user.sub },
      include: { review: true, store: { select: { ratingAvg: true, ratingCount: true } } },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== OrderStatus.DELIVERED) {
      throw new ConflictException('Só é possível avaliar pedidos entregues');
    }
    if (order.review) throw new ConflictException('Este pedido já foi avaliado');

    const count = order.store.ratingCount;
    const avg = order.store.ratingAvg ?? 0;
    const newAvg = (avg * count + dto.storeRating) / (count + 1);

    const [review] = await this.prisma.$transaction([
      this.prisma.review.create({
        data: {
          orderId,
          customerId: user.sub,
          storeRating: dto.storeRating,
          courierRating: dto.courierRating,
          comment: dto.comment,
        },
      }),
      this.prisma.store.update({
        where: { id: order.storeId },
        data: { ratingAvg: Math.round(newAvg * 100) / 100, ratingCount: count + 1 },
      }),
    ]);
    return review;
  }

  // ============================ CONSULTAS ============================

  mine(user: JwtPayload) {
    return this.prisma.order.findMany({
      where: { customerId: user.sub },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async byStore(storeId: string, user: JwtPayload, status?: OrderStatus) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        ...(user.role === UserRole.ADMIN ? {} : { ownerId: user.sub }),
      },
    });
    if (!store) throw new NotFoundException('Loja não encontrada');

    return this.prisma.order.findMany({
      where: {
        storeId,
        ...(status ? { status } : {}),
        // Pix ainda não pago não existe para o lojista
        NOT: {
          paymentMethod: PaymentMethod.PIX,
          paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
        },
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async byId(orderId: string, user: JwtPayload) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...(user.role === UserRole.ADMIN
          ? {}
          : user.role === UserRole.STORE_OWNER
            ? { store: { ownerId: user.sub } }
            : { customerId: user.sub }),
      },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return order;
  }
}
