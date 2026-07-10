import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// --- Categorias do cardápio ---

export class CreateMenuCategoryDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome da categoria' })
  name: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMenuCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Informe o nome da categoria' })
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// --- Produtos ---

export class CreateProductDto {
  @IsString({ message: 'Informe a categoria do produto' })
  categoryId: string;

  @IsString()
  @MinLength(2, { message: 'Informe o nome do produto' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({}, { message: 'Preço inválido' })
  @Min(0.01, { message: 'Preço deve ser maior que zero' })
  price: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Informe o nome do produto' })
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Preço inválido' })
  @Min(0.01, { message: 'Preço deve ser maior que zero' })
  price?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class SetAvailabilityDto {
  @IsBoolean({ message: 'Informe available: true ou false' })
  available: boolean;
}

// --- Grupos de opções (complementos) ---

export class CreateOptionGroupDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome do grupo (ex.: Tamanho, Adicionais)' })
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minSelect?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSelect?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateOptionGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minSelect?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSelect?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

// --- Opções ---

export class CreateOptionDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome da opção' })
  name: string;

  @IsOptional()
  @IsNumber({}, { message: 'Preço adicional inválido' })
  @Min(0)
  extraPrice?: number;
}

export class UpdateOptionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraPrice?: number;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
