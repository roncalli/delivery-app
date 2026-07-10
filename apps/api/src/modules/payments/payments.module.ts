import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

// O provider PAYMENT_GATEWAY vem do GatewayModule (global) — ver gateway.module.ts.
// Módulo sensível: mudanças aqui sempre com revisão do Claude/humana.
@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
