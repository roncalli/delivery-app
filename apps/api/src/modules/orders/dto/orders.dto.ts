import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemInputDto {
  @IsString({ message: 'Informe o produto' })
  productId: string;

  @IsInt({ message: 'Quantidade inválida' })
  @Min(1, { message: 'Quantidade mínima é 1' })
  @Max(50, { message: 'Quantidade máxima é 50' })
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Observação muito longa' })
  note?: string;

  /** Ids das opções escolhidas (de qualquer grupo do produto). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionIds?: string[];
}

export class CreateOrderDto {
  @IsString({ message: 'Informe a loja' })
  storeId: string;

  @IsString({ message: 'Informe o endereço de entrega' })
  addressId: string;

  @IsEnum(PaymentMethod, { message: 'Forma de pagamento inválida' })
  paymentMethod: PaymentMethod;

  /** Para pagamento em dinheiro: "troco para quanto?" */
  @IsOptional()
  @IsNumber({}, { message: 'Valor de troco inválido' })
  @Min(0)
  changeFor?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Observação muito longa' })
  customerNote?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'O carrinho está vazio' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
