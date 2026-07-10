import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { StoreStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { isOpenAt, OpeningInterval } from '../stores/opening-hours';

/** Vitrine pública — endpoints sem autenticação usados pelo app do cliente. */
@Public()
@Controller('catalog')
export class PublicCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stores')
  async listStores(
    @Query('cityId') cityId?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    const stores = await this.prisma.store.findMany({
      where: {
        status: StoreStatus.ACTIVE,
        ...(cityId ? { cityId } : {}),
        ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
        minOrderValue: true,
        avgPrepMinutes: true,
        deliveryMode: true,
        openingHours: true,
        deliveryZones: { select: { fee: true } },
      },
      orderBy: { name: 'asc' },
    });

    const now = new Date();
    return stores.map(({ openingHours, deliveryZones, ...store }) => ({
      ...store,
      isOpenNow: isOpenAt(openingHours as unknown as OpeningInterval[], now),
      minDeliveryFee: deliveryZones.length
        ? Math.min(...deliveryZones.map((z) => Number(z.fee)))
        : null,
    }));
  }

  @Get('stores/:slug')
  async storeDetail(@Param('slug') slug: string) {
    const store = await this.prisma.store.findFirst({
      where: { slug, status: { in: [StoreStatus.ACTIVE, StoreStatus.PAUSED] } },
      include: {
        deliveryZones: true,
        menuCategories: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            products: {
              orderBy: { sortOrder: 'asc' },
              include: {
                optionGroups: {
                  orderBy: { sortOrder: 'asc' },
                  include: { options: { where: { available: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!store) throw new NotFoundException('Loja não encontrada');

    const { openingHours, ...rest } = store;
    return {
      ...rest,
      openingHours,
      isOpenNow:
        store.status === StoreStatus.ACTIVE &&
        isOpenAt(openingHours as unknown as OpeningInterval[], new Date()),
    };
  }
}
