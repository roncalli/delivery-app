import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrderStatus, StoreStatus, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateStoreDto } from '../stores/dto/stores.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { AdminService } from './admin.service';

class SuspendStoreDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class AdminCreateStoreDto {
  @ValidateNested()
  @Type(() => CreateStoreDto)
  store: CreateStoreDto;

  @IsString()
  @MinLength(2, { message: 'Informe o nome do dono' })
  ownerName: string;

  @Matches(/^\+[1-9]\d{9,14}$/, { message: 'Telefone do dono no formato +5534999990000' })
  ownerPhone: string;

  @IsEmail({}, { message: 'E-mail do dono inválido' })
  ownerEmail: string;

  /** Senha inicial — obrigatória apenas se o dono ainda não tem conta. */
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Senha com no mínimo 6 caracteres' })
  ownerPassword?: string;
}

class UpdateCommissionDto {
  @IsNumber({}, { message: 'Comissão inválida' })
  @Min(0)
  @Max(50)
  commissionPct: number;
}

class CreatePayoutDto {
  @IsOptional()
  @IsString()
  pixKey?: string;
}

class CreateCityDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome da cidade' })
  name: string;

  @IsString()
  @Length(2, 2, { message: 'UF com 2 letras' })
  state: string;
}

class SetCityActiveDto {
  @IsBoolean()
  active: boolean;
}

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  /** Rota de sanidade da autorização: só ADMIN passa. */
  @Get('ping')
  ping(@CurrentUser() user: JwtPayload) {
    return { pong: true, userId: user.sub };
  }

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('orders')
  listOrders(@Query('status') status?: OrderStatus) {
    return this.adminService.listOrders(status);
  }

  // --- Lojas ---

  @Get('stores')
  listStores(@Query('status') status?: StoreStatus) {
    return this.prisma.store.findMany({
      where: status ? { status } : {},
      include: { owner: { select: { id: true, name: true, phone: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Onboarding pelo admin: cria dono (se necessário) + loja já ativa. */
  @Post('stores')
  createStore(@Body() dto: AdminCreateStoreDto) {
    return this.adminService.createStore(dto);
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

  @Patch('stores/:id/commission')
  updateCommission(@Param('id') id: string, @Body() dto: UpdateCommissionDto) {
    return this.adminService.updateCommission(id, dto.commissionPct);
  }

  // --- Financeiro ---

  @Get('finance')
  finance() {
    return this.adminService.finance();
  }

  @Post('wallets/:id/payout')
  createPayout(@Param('id') id: string, @Body() dto: CreatePayoutDto) {
    return this.adminService.createPayout(id, dto.pixKey);
  }

  // --- Cidades ---

  @Get('cities')
  listCities() {
    return this.adminService.listCities();
  }

  @Post('cities')
  createCity(@Body() dto: CreateCityDto) {
    return this.adminService.createCity(dto.name, dto.state);
  }

  @Patch('cities/:id/active')
  setCityActive(@Param('id') id: string, @Body() dto: SetCityActiveDto) {
    return this.adminService.setCityActive(id, dto.active);
  }

  private async assertStore(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Loja não encontrada');
  }
}
