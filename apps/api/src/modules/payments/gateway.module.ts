import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsaasGateway } from './gateways/asaas.gateway';
import { MockGateway } from './gateways/mock.gateway';
import { PAYMENT_GATEWAY } from './payment-gateway.interface';

/**
 * Provider global do gateway de pagamento — escolhido pela env PAYMENT_GATEWAY
 * (mock | asaas). Global para o OrdersService injetar sem import circular.
 */
@Global()
@Module({
  providers: [
    MockGateway,
    AsaasGateway,
    {
      provide: PAYMENT_GATEWAY,
      useFactory: (config: ConfigService, mock: MockGateway, asaas: AsaasGateway) =>
        (config.get<string>('PAYMENT_GATEWAY') ?? 'mock') === 'asaas' ? asaas : mock,
      inject: [ConfigService, MockGateway, AsaasGateway],
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class GatewayModule {}
