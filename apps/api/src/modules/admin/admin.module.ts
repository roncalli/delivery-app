import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';

// Etapa 8: aprovação de lojas/entregadores, monitor de pedidos, financeiro
// (repasses), configurações da plataforma e banners.
@Module({
  controllers: [AdminController],
})
export class AdminModule {}
