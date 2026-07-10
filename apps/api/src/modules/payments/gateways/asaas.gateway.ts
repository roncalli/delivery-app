import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentGateway,
  PixCharge,
  WebhookEvent,
} from '../payment-gateway.interface';

/**
 * Gateway Asaas (https://docs.asaas.com).
 * PENDENTE DE VALIDAÇÃO EM SANDBOX: requer conta Asaas + ASAAS_API_KEY.
 * TODO produção: coletar CPF do cliente no checkout — o Asaas exige cpfCnpj
 * na criação do customer.
 */
@Injectable()
export class AsaasGateway implements PaymentGateway {
  readonly provider = 'asaas';
  private readonly logger = new Logger(AsaasGateway.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl() {
    return this.config.get<string>('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3';
  }

  private async request(path: string, options: RequestInit = {}) {
    const apiKey = this.config.get<string>('ASAAS_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Pagamento online indisponível no momento');
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        access_token: apiKey,
        ...options.headers,
      },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      this.logger.error(`Asaas ${path} falhou: ${res.status} ${JSON.stringify(body)}`);
      throw new ServiceUnavailableException('Falha ao criar a cobrança — tente novamente');
    }
    return body;
  }

  async createPixCharge(params: {
    orderId: string;
    orderNumber: number;
    amountCents: number;
    customerName: string;
    customerPhone: string;
    expiresInSeconds: number;
  }): Promise<PixCharge> {
    // TODO: reutilizar customer existente por telefone (GET /customers?mobilePhone=)
    const customer = await this.request('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: params.customerName,
        mobilePhone: params.customerPhone.replace('+55', ''),
        // cpfCnpj: <coletar no checkout — obrigatório no Asaas>
      }),
    });

    const payment = await this.request('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: customer.id,
        billingType: 'PIX',
        value: params.amountCents / 100,
        dueDate: new Date().toISOString().slice(0, 10),
        externalReference: params.orderId,
        description: `Pedido #${params.orderNumber}`,
      }),
    });

    const qr = await this.request(`/payments/${payment.id}/pixQrCode`);

    return {
      chargeId: payment.id,
      copiaECola: qr.payload,
      expiresAt: new Date(Date.now() + params.expiresInSeconds * 1000),
    };
  }

  async refund(chargeId: string): Promise<void> {
    await this.request(`/payments/${chargeId}/refund`, { method: 'POST' });
  }

  parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): WebhookEvent | null {
    const expected = this.config.get<string>('ASAAS_WEBHOOK_TOKEN');
    if (!expected || headers['asaas-access-token'] !== expected) return null;

    const b = body as { event?: string; payment?: { id?: string } };
    if (!b?.payment?.id) return null;
    if (b.event === 'PAYMENT_RECEIVED' || b.event === 'PAYMENT_CONFIRMED') {
      return { type: 'PAYMENT_CONFIRMED', chargeId: b.payment.id };
    }
    if (b.event === 'PAYMENT_REFUNDED') {
      return { type: 'PAYMENT_REFUNDED', chargeId: b.payment.id };
    }
    return { type: 'OTHER', chargeId: b.payment.id };
  }
}
