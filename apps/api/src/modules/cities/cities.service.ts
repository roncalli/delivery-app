import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllActive() {
    return this.prisma.city.findMany({
      where: { active: true },
      orderBy: [{ state: 'asc' }, { name: 'asc' }],
    });
  }
}
