import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

/** Token de injeção do client Redis compartilhado (cache, OTP, locks). */
export const REDIS = 'REDIS';
/** Token de injeção da fila de pedidos (timeouts de aceite — Etapa 4). */
export const ORDERS_QUEUE = 'ORDERS_QUEUE';

/** Converte REDIS_URL em opções de conexão para o BullMQ gerenciar seus próprios clients. */
function parseRedisUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    db: Number(url.pathname.slice(1) || 0),
  };
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379'),
      inject: [ConfigService],
    },
    {
      provide: ORDERS_QUEUE,
      useFactory: (config: ConfigService) =>
        new Queue('orders', {
          connection: parseRedisUrl(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379'),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [REDIS, ORDERS_QUEUE],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown() {
    await this.moduleRef.get<Queue>(ORDERS_QUEUE).close();
    this.moduleRef.get<Redis>(REDIS).disconnect();
  }
}
