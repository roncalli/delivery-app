import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  PaymentGateway,
  PixCharge,
  WebhookEvent,
} from '../payment-gateway.interface';

/**
 * Gateway de mentira para desenvolvimento e testes.
 * "Pagar" = chamar o webhook com { event: 'PAYMENT_CONFIRMED', chargeId } e o
 * header x-webhook-token correto (o endpoint dev /payments/dev/simulate faz isso).
 */
@Injectable()
export class MockGateway implements PaymentGateway {
  readonly provider = 'mock';
  private readonly logger = new Logger(MockGateway.name);

  constructor(private readonly config: ConfigService) {}

  async createPixCharge(params: {
    orderId: string;
    orderNumber: number;
    amountCents: number;
    expiresInSeconds: number;
  }): Promise<PixCharge> {
    const chargeId = `mock_${randomUUID()}`;
    this.logger.log(
      `[Pix mock] cobrança ${chargeId} de R$ ${(params.amountCents / 100).toFixed(2)} para o pedido #${params.orderNumber}`,
    );
    return {
      chargeId,
      // formato parecido com um BR Code real, mas inválido de propósito
      copiaECola: `00020126MOCK${chargeId}5204000053039865802BR5913DELIVERY DEV6009DEV CITY62070503***6304MOCK`,
      expiresAt: new Date(Date.now() + params.expiresInSeconds * 1000),
    };
  }

  async refund(chargeId: string): Promise<void> {
    this.logger.log(`[Pix mock] estorno da cobrança ${chargeId}`);
  }

  parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): WebhookEvent | null {
    const token = this.config.get<string>('PAYMENT_WEBHOOK_TOKEN') ?? 'dev-webhook-token';
    if (headers['x-webhook-token'] !== token) return null;

    const b = body as { event?: string; chargeId?: string };
    if (!b?.chargeId) return null;
    if (b.event === 'PAYMENT_CONFIRMED') return { type: 'PAYMENT_CONFIRMED', chargeId: b.chargeId };
    if (b.event === 'PAYMENT_REFUNDED') return { type: 'PAYMENT_REFUNDED', chargeId: b.chargeId };
    return { type: 'OTHER', chargeId: b.chargeId };
  }
}
