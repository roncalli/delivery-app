import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CitiesService } from './cities.service';

@Public()
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  /** Cidades ativas — usado pelo seletor de cidade da vitrine. Rota pública. */
  @Get()
  findAllActive() {
    return this.citiesService.findAllActive();
  }
}
