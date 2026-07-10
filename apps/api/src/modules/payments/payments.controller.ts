import { Body, Controller, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Recebe notificações do gateway (a autenticação é do próprio gateway). */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    return this.paymentsService.handleWebhook(headers, body);
  }

  /** Dev (gateway mock): simula o pagamento do pedido. */
  @Roles(UserRole.CUSTOMER)
  @Post('dev/simulate/:orderId')
  @HttpCode(200)
  devSimulate(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.paymentsService.devSimulatePayment(orderId, user);
  }
}
