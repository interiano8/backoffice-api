import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AdjustStockDto {
  @IsString()
  @IsNotEmpty()
  storeCode: string;

  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsNumber()
  quantityDelta: number;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsNumber()
  minStock?: number;
}
