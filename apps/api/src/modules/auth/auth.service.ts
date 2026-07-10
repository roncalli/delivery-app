import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';
import { JwtPayload } from './jwt-payload.interface';
import { OtpService } from './otp.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'name' | 'phone' | 'email' | 'role'>;
}

/** Converte "30d" | "12h" | "15m" | "45s" em segundos. */
function durationToSeconds(value: string, fallbackSeconds: number): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return fallbackSeconds;
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return Number(match[1]) * mult;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly otpService: OtpService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async requestOtp(phone: string): Promise<{ message: string }> {
    await this.otpService.request(phone);
    return { message: 'Código enviado' };
  }

  /** Valida o OTP; cria o usuário (CUSTOMER) no primeiro acesso. */
  async verifyOtp(phone: string, code: string): Promise<AuthTokens> {
    await this.otpService.verify(phone, code);

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, name: 'Cliente', role: UserRole.CUSTOMER },
    });

    return this.issueTokens(user);
  }

  /** Login por e-mail/senha (lojista e admin). */
  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // bcrypt.compare mesmo sem usuário: evita revelar e-mails cadastrados via timing
    const hash = user?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalido';
    const valid = await bcrypt.compare(password, hash);
    if (!user?.passwordHash || !valid) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }
    return this.issueTokens(user);
  }

  /** Rotação: valida o refresh token, invalida o antigo e emite um novo par. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Sessão expirada, entre novamente');
    }
    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Token inválido');
    }

    // Token já usado/revogado (rotação) → possível roubo; rejeita
    const deleted = await this.redis.del(`refresh:${payload.jti}`);
    if (deleted === 0) {
      throw new UnauthorizedException('Sessão expirada, entre novamente');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
      if (payload.jti) await this.redis.del(`refresh:${payload.jti}`);
    } catch {
      // token inválido já está "deslogado"
    }
    return { message: 'Sessão encerrada' };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const jti = randomUUID();
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
    const refreshTtl = durationToSeconds(refreshExpiresIn, 30 * 86400);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ sub: user.id, role: user.role }),
      this.jwtService.signAsync(
        { sub: user.id, role: user.role, type: 'refresh', jti },
        { expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'] },
      ),
    ]);
    await this.redis.set(`refresh:${jti}`, user.id, 'EX', refreshTtl);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    };
  }
}
