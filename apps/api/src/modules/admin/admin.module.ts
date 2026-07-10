import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// Operação da plataforma: dashboard, aprovação de lojas, monitor de pedidos,
// financeiro (repasses) e cidades. Fase 2: banners, cupons da plataforma.
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
