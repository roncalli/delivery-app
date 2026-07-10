import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import {
  CreateDeliveryZoneDto,
  CreateStoreDto,
  UpdateDeliveryZoneDto,
  UpdateStoreDto,
} from './dto/stores.dto';
import { StoresService } from './stores.service';

@Roles(UserRole.STORE_OWNER, UserRole.ADMIN)
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateStoreDto) {
    return this.storesService.create(user, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.storesService.mine(user);
  }

  @Get(':id/finance')
  finance(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.storesService.finance(id, user);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.update(id, user, dto);
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.storesService.setPaused(id, user, true);
  }

  @Post(':id/resume')
  resume(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.storesService.setPaused(id, user, false);
  }

  @Post(':id/delivery-zones')
  createZone(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateDeliveryZoneDto,
  ) {
    return this.storesService.createZone(id, user, dto);
  }

  @Patch('delivery-zones/:zoneId')
  updateZone(
    @CurrentUser() user: JwtPayload,
    @Param('zoneId') zoneId: string,
    @Body() dto: UpdateDeliveryZoneDto,
  ) {
    return this.storesService.updateZone(zoneId, user, dto);
  }

  @Delete('delivery-zones/:zoneId')
  deleteZone(@CurrentUser() user: JwtPayload, @Param('zoneId') zoneId: string) {
    return this.storesService.deleteZone(zoneId, user);
  }
}
