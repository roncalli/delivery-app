/** Token de injeção do gateway de pagamento ativo. */
export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';

export interface PixCharge {
  chargeId: string;
  copiaECola: string;
  expiresAt: Date;
}

/** Evento de webhook normalizado (independente do gateway). */
export interface WebhookEvent {
  type: 'PAYMENT_CONFIRMED' | 'PAYMENT_REFUNDED' | 'OTHER';
  chargeId: string;
}

/**
 * Abstração do gateway de pagamento. Implementações: MockGateway (dev/testes)
 * e AsaasGateway (produção). Trocar de gateway = nova implementação desta
 * interface, sem tocar no fluxo de pedidos.
 */
export interface PaymentGateway {
  readonly provider: string;

  createPixCharge(params: {
    orderId: string;
    orderNumber: number;
    amountCents: number;
    customerName: string;
    customerPhone: string;
    expiresInSeconds: number;
  }): Promise<PixCharge>;

  /** Estorno total da cobrança. Deve lançar erro se o gateway recusar. */
  refund(chargeId: string): Promise<void>;

  /**
   * Valida a autenticidade do webhook (token/assinatura) e normaliza o evento.
   * Retorna null se a requisição não for autêntica.
   */
  parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): WebhookEvent | null;
}
