import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductPriceDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsOptional()
  @IsString()
  storeCode?: string | null; // null o undefined = global para todas las tiendas

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductPriceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
