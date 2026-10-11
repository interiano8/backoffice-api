import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PromotionItemDto {
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsNumber()
  @Min(0.01)
  quantityRequired: number;

  @IsOptional()
  @IsBoolean()
  isReward?: boolean;
}

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  type: 'FIXED_PRICE_COMBO' | 'PERCENT_DISCOUNT' | 'BUY_X_GET_Y' | string;

  @IsOptional()
  @IsNumber()
  fixedPrice?: number;

  @IsOptional()
  @IsNumber()
  discountPct?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  storeCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionItemDto)
  items: PromotionItemDto[];
}

export class CartItemDto {
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  unitPrice: number;
}

export class EvaluatePromotionsDto {
  @IsOptional()
  @IsString()
  storeCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}
