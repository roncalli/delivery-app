import { Controller, Get } from '@nestjs/common';
import { CitiesService } from './cities.service';

@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  /** Cidades ativas — usado pelo seletor de cidade da vitrine. Rota pública. */
  @Get()
  findAllActive() {
    return this.citiesService.findAllActive();
  }
}
