import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { OrdersService } from '../orders/orders.service';
import { PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway.interface';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /**
   * Webhook do gateway. Responde rápido; o processamento é idempotente
   * (evento duplicado não confirma duas vezes).
   */
  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ) {
    const event = this.gateway.parseWebhook(headers, body);
    if (!event) {
      throw new UnauthorizedException('Webhook não autenticado');
    }

    switch (event.type) {
      case 'PAYMENT_CONFIRMED': {
        const processed = await this.ordersService.markPixPaid(event.chargeId);
        this.logger.log(
          `Webhook PAYMENT_CONFIRMED ${event.chargeId} → ${processed ? 'processado' : 'ignorado (duplicado/cancelado)'}`,
        );
        break;
      }
      case 'PAYMENT_REFUNDED':
        await this.ordersService.markPixRefunded(event.chargeId);
        break;
      default:
        break; // eventos irrelevantes são aceitos e ignorados
    }
    return { received: true };
  }

  /**
   * SÓ NO GATEWAY MOCK: simula o pagamento do próprio pedido — botão
   * "Simular pagamento" na tela do cliente durante o desenvolvimento.
   */
  async devSimulatePayment(orderId: string, user: JwtPayload) {
    if (this.gateway.provider !== 'mock') {
      throw new ForbiddenException('Disponível apenas no ambiente de desenvolvimento');
    }
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId: user.sub,
        paymentMethod: PaymentMethod.PIX,
        paymentStatus: PaymentStatus.PENDING,
      },
    });
    if (!order?.gatewayChargeId) {
      throw new NotFoundException('Pedido não encontrado ou já pago');
    }
    await this.ordersService.markPixPaid(order.gatewayChargeId);
    return { paid: true };
  }
}
