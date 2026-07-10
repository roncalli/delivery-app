import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { StoreStatus, UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';

class SuspendStoreDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  /** Rota de sanidade da autorização: só ADMIN passa. */
  @Get('ping')
  ping(@CurrentUser() user: JwtPayload) {
    return { pong: true, userId: user.sub };
  }

  /** Lista lojas por status — a fila de aprovação usa ?status=PENDING. */
  @Get('stores')
  listStores(@Query('status') status?: StoreStatus) {
    return this.prisma.store.findMany({
      where: status ? { status } : {},
      include: { owner: { select: { id: true, name: true, phone: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('stores/:id/approve')
  async approveStore(@Param('id') id: string) {
    await this.assertStore(id);
    return this.prisma.store.update({
      where: { id },
      data: { status: StoreStatus.ACTIVE },
    });
  }

  @Post('stores/:id/suspend')
  async suspendStore(@Param('id') id: string, @Body() _dto: SuspendStoreDto) {
    await this.assertStore(id);
    return this.prisma.store.update({
      where: { id },
      data: { status: StoreStatus.SUSPENDED },
    });
  }

  private async assertStore(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Loja não encontrada');
  }
}
