import { DeliveryMode, ZoneType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class OpeningIntervalDto {
  @IsInt()
  @Min(0, { message: 'Dia da semana entre 0 (domingo) e 6 (sábado)' })
  @Max(6, { message: 'Dia da semana entre 0 (domingo) e 6 (sábado)' })
  day: number;

  @Matches(TIME_REGEX, { message: 'Horário de abertura no formato HH:MM' })
  open: string;

  @Matches(TIME_REGEX, { message: 'Horário de fechamento no formato HH:MM' })
  close: string;
}

export class CreateStoreDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome da loja' })
  name: string;

  @IsString()
  @MinLength(2, { message: 'Informe a categoria (ex.: Pizza, Lanches)' })
  category: string;

  @IsString()
  @MinLength(11, { message: 'Informe o CPF ou CNPJ' })
  document: string;

  @IsString({ message: 'Informe a cidade' })
  cityId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(DeliveryMode, { message: 'Modo de entrega inválido' })
  deliveryMode?: DeliveryMode;

  @IsOptional()
  @IsLatitude({ message: 'Latitude inválida' })
  lat?: number;

  @IsOptional()
  @IsLongitude({ message: 'Longitude inválida' })
  lng?: number;
}

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Informe o nome da loja' })
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(DeliveryMode, { message: 'Modo de entrega inválido' })
  deliveryMode?: DeliveryMode;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningIntervalDto)
  openingHours?: OpeningIntervalDto[];

  @IsOptional()
  @IsNumber({}, { message: 'Pedido mínimo inválido' })
  @Min(0)
  minOrderValue?: number;

  @IsOptional()
  @IsInt({ message: 'Tempo de preparo em minutos' })
  @Min(5)
  avgPrepMinutes?: number;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsLatitude({ message: 'Latitude inválida' })
  lat?: number;

  @IsOptional()
  @IsLongitude({ message: 'Longitude inválida' })
  lng?: number;
}

export class CreateDeliveryZoneDto {
  @IsEnum(ZoneType, { message: 'Tipo de zona inválido (RADIUS ou NEIGHBORHOOD)' })
  type: ZoneType;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Informe o bairro' })
  neighborhood?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Raio em km inválido' })
  @Min(0.5)
  radiusKm?: number;

  @IsNumber({}, { message: 'Taxa de entrega inválida' })
  @Min(0)
  fee: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  etaMinutes?: number;
}

export class UpdateDeliveryZoneDto {
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  radiusKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  etaMinutes?: number;
}
