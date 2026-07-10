import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CancelOrderDto, CreateOrderDto, CreateReviewDto } from './dto/orders.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Checkout — cliente cria o pedido. */
  @Roles(UserRole.CUSTOMER)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user, dto);
  }

  /** Pedidos do cliente logado. */
  @Roles(UserRole.CUSTOMER)
  @Get('mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.ordersService.mine(user);
  }

  /** Pedidos da loja (gestor de pedidos do lojista). */
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN)
  @Get('store/:storeId')
  byStore(
    @CurrentUser() user: JwtPayload,
    @Param('storeId') storeId: string,
    @Query('status') status?: OrderStatus,
  ) {
    return this.ordersService.byStore(storeId, user, status);
  }

  /** Detalhe de um pedido (participante ou admin). */
  @Get(':id')
  byId(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.byId(id, user);
  }

  // --- Transições (a autorização fina fica no service.assertActor) ---

  @Post(':id/accept')
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.transition(id, OrderStatus.ACCEPTED, user);
  }

  @Post(':id/ready')
  ready(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.transition(id, OrderStatus.READY, user);
  }

  @Post(':id/dispatch')
  dispatch(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.transition(id, OrderStatus.OUT_FOR_DELIVERY, user);
  }

  @Post(':id/deliver')
  deliver(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.transition(id, OrderStatus.DELIVERED, user);
  }

  /** Avaliação do pedido entregue. */
  @Roles(UserRole.CUSTOMER)
  @Post(':id/review')
  review(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.ordersService.review(id, user, dto);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.transition(id, OrderStatus.CANCELED, user, dto.reason);
  }
}
