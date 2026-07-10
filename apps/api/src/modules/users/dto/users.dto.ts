import {
  IsBoolean,
  IsEmail,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Informe seu nome' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string;
}

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString({ message: 'Informe a rua' })
  @MinLength(2, { message: 'Informe a rua' })
  street: string;

  @IsString({ message: 'Informe o número' })
  number: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsString({ message: 'Informe o bairro' })
  @MinLength(2, { message: 'Informe o bairro' })
  neighborhood: string;

  @IsString({ message: 'Informe a cidade' })
  cityId: string;

  @IsOptional()
  @IsLatitude({ message: 'Latitude inválida' })
  lat?: number;

  @IsOptional()
  @IsLongitude({ message: 'Longitude inválida' })
  lng?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Informe a rua' })
  street?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Informe o bairro' })
  neighborhood?: string;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsLatitude({ message: 'Latitude inválida' })
  lat?: number;

  @IsOptional()
  @IsLongitude({ message: 'Longitude inválida' })
  lng?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
