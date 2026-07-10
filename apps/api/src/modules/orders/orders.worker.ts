import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { OrdersService } from './orders.service';

/** Processa os jobs de timeout de aceite da fila "orders". */
@Injectable()
export class OrdersWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OrdersWorker.name);
  private worker?: Worker;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const url = new URL(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
    this.worker = new Worker(
      'orders',
      async (job: Job<{ orderId: string }>) => {
        switch (job.name) {
          case 'accept-warn':
            return this.ordersService.handleAcceptWarn(job.data.orderId);
          case 'accept-cancel':
            return this.ordersService.handleAcceptCancel(job.data.orderId);
          default:
            this.logger.warn(`Job desconhecido na fila orders: ${job.name}`);
        }
      },
      {
        connection: {
          host: url.hostname,
          port: Number(url.port || 6379),
          password: url.password || undefined,
          db: Number(url.pathname.slice(1) || 0),
        },
      },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Job ${job?.name}(${job?.id}) falhou: ${err.message}`),
    );
  }

  async onApplicationShutdown() {
    await this.worker?.close();
  }
}
