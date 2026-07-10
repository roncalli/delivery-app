import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';

const OTP_TTL_SECONDS = 5 * 60;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_MAX = 3;
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Gera, envia e valida códigos OTP por telefone.
 * Provider "mock" (dev): loga o código no console da API.
 * Produção: implementar envio via WhatsApp/SMS neste mesmo serviço.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async request(phone: string): Promise<void> {
    const countKey = `otp:count:${phone}`;
    const count = await this.redis.incr(countKey);
    if (count === 1) {
      await this.redis.expire(countKey, RATE_LIMIT_WINDOW_SECONDS);
    }
    if (count > RATE_LIMIT_MAX) {
      throw new BadRequestException(
        'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.redis.set(`otp:${phone}`, code, 'EX', OTP_TTL_SECONDS);
    await this.redis.del(`otp:attempts:${phone}`);

    const provider = this.config.get<string>('OTP_PROVIDER') ?? 'mock';
    if (provider === 'mock') {
      this.logger.log(`[OTP mock] código para ${phone}: ${code}`);
    } else {
      // TODO produção: enviar via WhatsApp Business API / SMS
      throw new BadRequestException('Provider de OTP não configurado');
    }
  }

  /** Valida e consome o código. Lança 401 se inválido/expirado. */
  async verify(phone: string, code: string): Promise<void> {
    const attemptsKey = `otp:attempts:${phone}`;
    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, OTP_TTL_SECONDS);
    }
    if (attempts > MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(`otp:${phone}`);
      throw new UnauthorizedException('Código bloqueado. Solicite um novo.');
    }

    const stored = await this.redis.get(`otp:${phone}`);
    if (!stored || stored !== code) {
      throw new UnauthorizedException('Código inválido ou expirado');
    }
    await this.redis.del(`otp:${phone}`, attemptsKey);
  }
}
