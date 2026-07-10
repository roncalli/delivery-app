import { Module } from '@nestjs/common';
import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';

// Módulo-modelo: os CRUDs das próximas etapas seguem este padrão
// controller (rotas + validação) → service (regra de negócio + Prisma).
@Module({
  controllers: [CitiesController],
  providers: [CitiesService],
  exports: [CitiesService],
})
export class CitiesModule {}
