import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductThresholdItemDto {
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsNumber()
  @Min(0)
  minStock: number;
}

export class UpdateThresholdDto {
  @IsString()
  @IsNotEmpty()
  storeCode: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductThresholdItemDto)
  items: ProductThresholdItemDto[];
}
