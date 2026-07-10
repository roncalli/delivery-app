import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { OrdersService } from './orders.service';
import { OrdersWorker } from './orders.worker';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway, OrdersWorker],
  exports: [OrdersService],
})
export class OrdersModule {}
