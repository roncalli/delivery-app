import {
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
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Pedido "visível": exclui Pix ainda não pago (o lojista nunca o viu). */
const VISIBLE_ORDER: Prisma.OrderWhereInput = {
  NOT: {
    paymentMethod: PaymentMethod.PIX,
    paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
  },
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================ DASHBOARD ============================

  async dashboard() {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);

    const [ordersToday, gmvToday, activeStores, pendingStores, commissionMonth, stuck] =
      await Promise.all([
        this.prisma.order.count({
          where: { createdAt: { gte: startToday }, ...VISIBLE_ORDER },
        }),
        this.prisma.order.aggregate({
          where: {
            createdAt: { gte: startToday },
            status: { not: OrderStatus.CANCELED },
            ...VISIBLE_ORDER,
          },
          _sum: { total: true },
        }),
        this.prisma.store.count({ where: { status: StoreStatus.ACTIVE } }),
        this.prisma.store.count({ where: { status: StoreStatus.PENDING } }),
        this.prisma.transaction.aggregate({
          where: { type: TransactionType.COMMISSION, createdAt: { gte: startMonth } },
          _sum: { amount: true },
        }),
        // Pedidos presos: sem aceite há mais de 5 minutos
        this.prisma.order.findMany({
          where: {
            status: OrderStatus.CREATED,
            createdAt: { lt: fiveMinAgo },
            ...VISIBLE_ORDER,
          },
          include: {
            store: { select: { name: true } },
            customer: { select: { name: true, phone: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    const gmv = Number(gmvToday._sum.total ?? 0);
    return {
      ordersToday,
      gmvToday: gmv,
      avgTicket: ordersToday > 0 ? Math.round((gmv / ordersToday) * 100) / 100 : 0,
      activeStores,
      pendingStores,
      // comissões são débitos (negativas) na wallet do lojista → receita da plataforma
      commissionMonth: -Number(commissionMonth._sum.amount ?? 0),
      stuckOrders: stuck,
    };
  }

  // ========================= MONITOR DE PEDIDOS =========================

  listOrders(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: { ...(status ? { status } : {}) },
      include: {
        store: { select: { id: true, name: true } },
        customer: { select: { name: true, phone: true } },
        items: { select: { quantity: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ============================ LOJAS ============================

  async updateCommission(storeId: string, commissionPct: number) {
    await this.assertStore(storeId);
    if (commissionPct < 0 || commissionPct > 50) {
      throw new UnprocessableEntityException('Comissão deve estar entre 0% e 50%');
    }
    return this.prisma.store.update({
      where: { id: storeId },
      data: { commissionPct },
    });
  }

  // ============================ FINANCEIRO ============================

  async finance() {
    const [wallets, commissionTotal, payouts] = await Promise.all([
      this.prisma.wallet.findMany({
        where: { balance: { gt: 0 } },
        include: {
          store: { select: { name: true } },
          courier: { include: { user: { select: { name: true } } } },
        },
        orderBy: { balance: 'desc' },
      }),
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.COMMISSION },
        _sum: { amount: true },
      }),
      this.prisma.payout.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { wallet: { include: { store: { select: { name: true } } } } },
      }),
    ]);

    return {
      commissionTotal: -Number(commissionTotal._sum.amount ?? 0),
      wallets: wallets.map((w) => ({
        id: w.id,
        ownerType: w.ownerType,
        ownerName: w.store?.name ?? w.courier?.user.name ?? '—',
        balance: Number(w.balance),
        pixKey: w.pixKey,
      })),
      recentPayouts: payouts.map((p) => ({
        id: p.id,
        ownerName: p.wallet.store?.name ?? '—',
        amount: Number(p.amount),
        pixKey: p.pixKey,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Repasse manual: o admin faz o Pix por fora e registra aqui — debita a
   * wallet, cria o Payout e a transação, tudo atômico.
   */
  async createPayout(walletId: string, pixKey?: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      include: { store: { select: { name: true } } },
    });
    if (!wallet) throw new NotFoundException('Carteira não encontrada');

    const key = pixKey?.trim() || wallet.pixKey;
    if (!key) {
      throw new UnprocessableEntityException('Informe a chave Pix do recebedor');
    }
    const amount = Number(wallet.balance);
    if (amount <= 0) {
      throw new UnprocessableEntityException('Esta carteira não tem saldo a repassar');
    }

    const [payout] = await this.prisma.$transaction([
      this.prisma.payout.create({
        data: { walletId, amount, pixKey: key, status: 'done', processedAt: new Date() },
      }),
      this.prisma.transaction.create({
        data: {
          walletId,
          type: TransactionType.PAYOUT,
          status: 'SETTLED',
          amount: -amount,
          note: `Repasse via Pix para ${key}`,
        },
      }),
      this.prisma.wallet.update({
        where: { id: walletId },
        data: { balance: { decrement: amount }, pixKey: key },
      }),
    ]);
    return payout;
  }

  // ============================ CIDADES ============================

  async createCity(name: string, state: string) {
    return this.prisma.city.create({ data: { name: name.trim(), state: state.trim().toUpperCase() } });
  }

  async setCityActive(cityId: string, active: boolean) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw new NotFoundException('Cidade não encontrada');
    return this.prisma.city.update({ where: { id: cityId }, data: { active } });
  }

  listCities() {
    return this.prisma.city.findMany({
      orderBy: [{ state: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { stores: true } } },
    });
  }

  private async assertStore(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Loja não encontrada');
  }
}
