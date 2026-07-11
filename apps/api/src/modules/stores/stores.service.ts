import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderStatus, Prisma, StoreStatus, UserRole, ZoneType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import {
  CreateDeliveryZoneDto,
  CreateStoreDto,
  UpdateDeliveryZoneDto,
  UpdateStoreDto,
} from './dto/stores.dto';

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // remove acentos (combining marks do NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  /** Filtro de posse: admin enxerga qualquer loja; lojista só as suas. */
  private ownerFilter(user: JwtPayload): Prisma.StoreWhereInput {
    return user.role === UserRole.ADMIN ? {} : { ownerId: user.sub };
  }

  private async getOwnedStore(storeId: string, user: JwtPayload) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, ...this.ownerFilter(user) },
    });
    if (!store) throw new NotFoundException('Loja não encontrada');
    return store;
  }

  /** Autocadastro do lojista: a loja nasce PENDING até o admin aprovar. */
  create(user: JwtPayload, dto: CreateStoreDto) {
    return this.createForOwner(user.sub, dto, StoreStatus.PENDING);
  }

  /** Criação para um dono específico (usada também pelo admin, já ATIVA). */
  async createForOwner(ownerId: string, dto: CreateStoreDto, status: StoreStatus) {
    const city = await this.prisma.city.findFirst({
      where: { id: dto.cityId, active: true },
    });
    if (!city) {
      throw new UnprocessableEntityException('Cidade não atendida pela plataforma');
    }

    const slug = await this.uniqueSlug(dto.name);
    return this.prisma.store.create({
      data: {
        ...dto,
        slug,
        ownerId,
        status,
        wallet: { create: { ownerType: 'STORE' } },
      },
      include: { deliveryZones: true },
    });
  }

  mine(user: JwtPayload) {
    return this.prisma.store.findMany({
      where: { ownerId: user.sub },
      include: { deliveryZones: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(storeId: string, user: JwtPayload, dto: UpdateStoreDto) {
    await this.getOwnedStore(storeId, user);
    const { openingHours, ...rest } = dto;
    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        ...rest,
        ...(openingHours !== undefined
          ? { openingHours: openingHours as unknown as Prisma.InputJsonValue }
          : {}),
      },
      include: { deliveryZones: true },
    });
  }

  /** Pausar/retomar: só alterna entre ACTIVE e PAUSED (não mexe em PENDING/SUSPENDED). */
  async setPaused(storeId: string, user: JwtPayload, paused: boolean) {
    const store = await this.getOwnedStore(storeId, user);
    const expected = paused ? StoreStatus.ACTIVE : StoreStatus.PAUSED;
    if (store.status !== expected) {
      throw new ConflictException(
        paused ? 'Só é possível pausar uma loja ativa' : 'A loja não está pausada',
      );
    }
    return this.prisma.store.update({
      where: { id: storeId },
      data: { status: paused ? StoreStatus.PAUSED : StoreStatus.ACTIVE },
    });
  }

  /** Resumo financeiro do lojista: vendas por período, saldo e extrato. */
  async finance(storeId: string, user: JwtPayload) {
    await this.getOwnedStore(storeId, user);

    const wallet = await this.prisma.wallet.findUnique({
      where: { storeId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });

    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - startWeek.getDay()); // domingo
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const salesSince = async (gte: Date) => {
      const r = await this.prisma.order.aggregate({
        where: { storeId, status: OrderStatus.DELIVERED, deliveredAt: { gte } },
        _sum: { subtotal: true },
        _count: true,
      });
      return { total: Number(r._sum.subtotal ?? 0), orders: r._count };
    };

    return {
      balance: Number(wallet?.balance ?? 0),
      pixKey: wallet?.pixKey ?? null,
      today: await salesSince(startToday),
      week: await salesSince(startWeek),
      month: await salesSince(startMonth),
      transactions: wallet?.transactions ?? [],
    };
  }

  // --- Zonas de entrega ---

  async createZone(storeId: string, user: JwtPayload, dto: CreateDeliveryZoneDto) {
    await this.getOwnedStore(storeId, user);
    this.assertZoneShape(dto.type, dto);
    return this.prisma.deliveryZone.create({ data: { ...dto, storeId } });
  }

  async updateZone(zoneId: string, user: JwtPayload, dto: UpdateDeliveryZoneDto) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id: zoneId, store: this.ownerFilter(user) },
    });
    if (!zone) throw new NotFoundException('Zona de entrega não encontrada');
    return this.prisma.deliveryZone.update({ where: { id: zoneId }, data: dto });
  }

  async deleteZone(zoneId: string, user: JwtPayload) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id: zoneId, store: this.ownerFilter(user) },
    });
    if (!zone) throw new NotFoundException('Zona de entrega não encontrada');
    await this.prisma.deliveryZone.delete({ where: { id: zoneId } });
    return { message: 'Zona removida' };
  }

  private assertZoneShape(type: ZoneType, dto: CreateDeliveryZoneDto) {
    if (type === ZoneType.RADIUS && !dto.radiusKm) {
      throw new UnprocessableEntityException('Zona por raio exige radiusKm');
    }
    if (type === ZoneType.NEIGHBORHOOD && !dto.neighborhood) {
      throw new UnprocessableEntityException('Zona por bairro exige o nome do bairro');
    }
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'loja';
    let slug = base;
    for (let i = 2; ; i++) {
      const exists = await this.prisma.store.findUnique({ where: { slug } });
      if (!exists) return slug;
      slug = `${base}-${i}`;
    }
  }
}
