import { Controller, Get, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    const db = await this.prisma
      .$queryRaw`SELECT 1`.then(() => true)
      .catch(() => false);
    const redis = await this.redis
      .ping()
      .then((r) => r === 'PONG')
      .catch(() => false);

    return { status: db && redis ? 'ok' : 'degraded', db, redis };
  }
}
