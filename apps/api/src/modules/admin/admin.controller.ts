import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  /** Rota de sanidade da autorização: só ADMIN passa. */
  @Get('ping')
  ping(@CurrentUser() user: JwtPayload) {
    return { pong: true, userId: user.sub };
  }
}
