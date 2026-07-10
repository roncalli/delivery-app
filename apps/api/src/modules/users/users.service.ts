import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto, UpdateMeDto } from './dto/users.dto';

/** Campos públicos do usuário — nunca retornar passwordHash. */
const USER_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  updateMe(userId: string, dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, email: dto.email },
      select: USER_SELECT,
    });
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }],
      include: { city: true },
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const city = await this.prisma.city.findFirst({
      where: { id: dto.cityId, active: true },
    });
    if (!city) {
      throw new UnprocessableEntityException('Cidade não atendida pela plataforma');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      const isFirst = (await tx.address.count({ where: { userId } })) === 0;
      return tx.address.create({
        data: { ...dto, userId, isDefault: dto.isDefault || isFirst },
        include: { city: true },
      });
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.assertOwnership(userId, addressId);
    if (dto.cityId) {
      const city = await this.prisma.city.findFirst({
        where: { id: dto.cityId, active: true },
      });
      if (!city) {
        throw new UnprocessableEntityException('Cidade não atendida pela plataforma');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id: addressId },
        data: dto,
        include: { city: true },
      });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.assertOwnership(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
    return { message: 'Endereço removido' };
  }

  private async assertOwnership(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException('Endereço não encontrado');
  }
}
