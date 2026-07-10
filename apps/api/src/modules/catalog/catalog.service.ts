import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import {
  CreateMenuCategoryDto,
  CreateOptionDto,
  CreateOptionGroupDto,
  CreateProductDto,
  UpdateMenuCategoryDto,
  UpdateOptionDto,
  UpdateOptionGroupDto,
  UpdateProductDto,
} from './dto/catalog.dto';

/**
 * Gestão do cardápio pelo lojista. Toda operação valida a POSSE da cadeia
 * inteira (opção → grupo → produto → loja → dono) antes de tocar no banco.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private storeFilter(user: JwtPayload): Prisma.StoreWhereInput {
    return user.role === UserRole.ADMIN ? {} : { ownerId: user.sub };
  }

  // --- Categorias ---

  async createCategory(storeId: string, user: JwtPayload, dto: CreateMenuCategoryDto) {
    await this.assertStore(storeId, user);
    return this.prisma.menuCategory.create({ data: { ...dto, storeId } });
  }

  async listCategories(storeId: string, user: JwtPayload) {
    await this.assertStore(storeId, user);
    return this.prisma.menuCategory.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
          include: {
            optionGroups: {
              orderBy: { sortOrder: 'asc' },
              include: { options: true },
            },
          },
        },
      },
    });
  }

  async updateCategory(categoryId: string, user: JwtPayload, dto: UpdateMenuCategoryDto) {
    await this.assertCategory(categoryId, user);
    return this.prisma.menuCategory.update({ where: { id: categoryId }, data: dto });
  }

  async deleteCategory(categoryId: string, user: JwtPayload) {
    await this.assertCategory(categoryId, user);
    const products = await this.prisma.product.count({ where: { categoryId } });
    if (products > 0) {
      throw new UnprocessableEntityException(
        'Mova ou exclua os produtos desta categoria antes de removê-la',
      );
    }
    await this.prisma.menuCategory.delete({ where: { id: categoryId } });
    return { message: 'Categoria removida' };
  }

  // --- Produtos ---

  async createProduct(storeId: string, user: JwtPayload, dto: CreateProductDto) {
    await this.assertStore(storeId, user);
    const category = await this.prisma.menuCategory.findFirst({
      where: { id: dto.categoryId, storeId },
    });
    if (!category) throw new NotFoundException('Categoria não encontrada nesta loja');
    return this.prisma.product.create({
      data: { ...dto, storeId },
      include: { optionGroups: { include: { options: true } } },
    });
  }

  async updateProduct(productId: string, user: JwtPayload, dto: UpdateProductDto) {
    const product = await this.assertProduct(productId, user);
    if (dto.categoryId) {
      const category = await this.prisma.menuCategory.findFirst({
        where: { id: dto.categoryId, storeId: product.storeId },
      });
      if (!category) throw new NotFoundException('Categoria não encontrada nesta loja');
    }
    return this.prisma.product.update({
      where: { id: productId },
      data: dto,
      include: { optionGroups: { include: { options: true } } },
    });
  }

  /** Toggle rápido de disponibilidade ("esgotou"). */
  async setAvailability(productId: string, user: JwtPayload, available: boolean) {
    await this.assertProduct(productId, user);
    return this.prisma.product.update({
      where: { id: productId },
      data: { available },
    });
  }

  async deleteProduct(productId: string, user: JwtPayload) {
    await this.assertProduct(productId, user);
    const inOrders = await this.prisma.orderItem.count({ where: { productId } });
    if (inOrders > 0) {
      // Produto com histórico de pedidos não pode sumir do banco: desativa
      await this.prisma.product.update({
        where: { id: productId },
        data: { available: false },
      });
      return { message: 'Produto tem pedidos no histórico; foi desativado em vez de excluído' };
    }
    await this.prisma.product.delete({ where: { id: productId } });
    return { message: 'Produto removido' };
  }

  // --- Grupos de opções ---

  async createOptionGroup(productId: string, user: JwtPayload, dto: CreateOptionGroupDto) {
    await this.assertProduct(productId, user);
    this.assertGroupBounds(dto.minSelect ?? 0, dto.maxSelect ?? 1);
    return this.prisma.optionGroup.create({
      data: { ...dto, productId },
      include: { options: true },
    });
  }

  async updateOptionGroup(groupId: string, user: JwtPayload, dto: UpdateOptionGroupDto) {
    const group = await this.assertGroup(groupId, user);
    this.assertGroupBounds(dto.minSelect ?? group.minSelect, dto.maxSelect ?? group.maxSelect);
    return this.prisma.optionGroup.update({
      where: { id: groupId },
      data: dto,
      include: { options: true },
    });
  }

  async deleteOptionGroup(groupId: string, user: JwtPayload) {
    await this.assertGroup(groupId, user);
    await this.prisma.optionGroup.delete({ where: { id: groupId } });
    return { message: 'Grupo removido' };
  }

  // --- Opções ---

  async createOption(groupId: string, user: JwtPayload, dto: CreateOptionDto) {
    await this.assertGroup(groupId, user);
    return this.prisma.option.create({ data: { ...dto, groupId } });
  }

  async updateOption(optionId: string, user: JwtPayload, dto: UpdateOptionDto) {
    await this.assertOption(optionId, user);
    return this.prisma.option.update({ where: { id: optionId }, data: dto });
  }

  async deleteOption(optionId: string, user: JwtPayload) {
    await this.assertOption(optionId, user);
    const used = await this.prisma.orderItemOption.count({ where: { optionId } });
    if (used > 0) {
      await this.prisma.option.update({
        where: { id: optionId },
        data: { available: false },
      });
      return { message: 'Opção tem pedidos no histórico; foi desativada em vez de excluída' };
    }
    await this.prisma.option.delete({ where: { id: optionId } });
    return { message: 'Opção removida' };
  }

  // --- Asserções de posse ---

  private async assertStore(storeId: string, user: JwtPayload) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, ...this.storeFilter(user) },
    });
    if (!store) throw new NotFoundException('Loja não encontrada');
    return store;
  }

  private async assertCategory(categoryId: string, user: JwtPayload) {
    const category = await this.prisma.menuCategory.findFirst({
      where: { id: categoryId, store: this.storeFilter(user) },
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }

  private async assertProduct(productId: string, user: JwtPayload) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, store: this.storeFilter(user) },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  private async assertGroup(groupId: string, user: JwtPayload) {
    const group = await this.prisma.optionGroup.findFirst({
      where: { id: groupId, product: { store: this.storeFilter(user) } },
    });
    if (!group) throw new NotFoundException('Grupo de opções não encontrado');
    return group;
  }

  private async assertOption(optionId: string, user: JwtPayload) {
    const option = await this.prisma.option.findFirst({
      where: { id: optionId, group: { product: { store: this.storeFilter(user) } } },
    });
    if (!option) throw new NotFoundException('Opção não encontrada');
    return option;
  }

  private assertGroupBounds(min: number, max: number) {
    if (min > max) {
      throw new UnprocessableEntityException(
        'O mínimo de seleções não pode ser maior que o máximo',
      );
    }
  }
}
