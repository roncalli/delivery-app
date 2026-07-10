import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CatalogService } from './catalog.service';
import {
  CreateMenuCategoryDto,
  CreateOptionDto,
  CreateOptionGroupDto,
  CreateProductDto,
  SetAvailabilityDto,
  UpdateMenuCategoryDto,
  UpdateOptionDto,
  UpdateOptionGroupDto,
  UpdateProductDto,
} from './dto/catalog.dto';

/** Gestão do cardápio (lojista/admin). Vitrine pública fica no PublicCatalogController. */
@Roles(UserRole.STORE_OWNER, UserRole.ADMIN)
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // --- Categorias ---

  @Get('stores/:storeId/menu-categories')
  listCategories(@CurrentUser() user: JwtPayload, @Param('storeId') storeId: string) {
    return this.catalogService.listCategories(storeId, user);
  }

  @Post('stores/:storeId/menu-categories')
  createCategory(
    @CurrentUser() user: JwtPayload,
    @Param('storeId') storeId: string,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.catalogService.createCategory(storeId, user, dto);
  }

  @Patch('menu-categories/:id')
  updateCategory(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.catalogService.updateCategory(id, user, dto);
  }

  @Delete('menu-categories/:id')
  deleteCategory(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.catalogService.deleteCategory(id, user);
  }

  // --- Produtos ---

  @Post('stores/:storeId/products')
  createProduct(
    @CurrentUser() user: JwtPayload,
    @Param('storeId') storeId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.catalogService.createProduct(storeId, user, dto);
  }

  @Patch('products/:id')
  updateProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(id, user, dto);
  }

  @Patch('products/:id/availability')
  setAvailability(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.catalogService.setAvailability(id, user, dto.available);
  }

  @Delete('products/:id')
  deleteProduct(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.catalogService.deleteProduct(id, user);
  }

  // --- Grupos de opções ---

  @Post('products/:productId/option-groups')
  createGroup(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Body() dto: CreateOptionGroupDto,
  ) {
    return this.catalogService.createOptionGroup(productId, user, dto);
  }

  @Patch('option-groups/:id')
  updateGroup(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOptionGroupDto,
  ) {
    return this.catalogService.updateOptionGroup(id, user, dto);
  }

  @Delete('option-groups/:id')
  deleteGroup(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.catalogService.deleteOptionGroup(id, user);
  }

  // --- Opções ---

  @Post('option-groups/:groupId/options')
  createOption(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Body() dto: CreateOptionDto,
  ) {
    return this.catalogService.createOption(groupId, user, dto);
  }

  @Patch('options/:id')
  updateOption(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOptionDto,
  ) {
    return this.catalogService.updateOption(id, user, dto);
  }

  @Delete('options/:id')
  deleteOption(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.catalogService.deleteOption(id, user);
  }
}
