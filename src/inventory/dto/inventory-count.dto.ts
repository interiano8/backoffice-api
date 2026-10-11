import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryCountDto {
  @IsString()
  @IsNotEmpty()
  storeCode: string;

  @IsOptional()
  @IsString()
  countedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class InventoryCountItemUpdateDto {
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsNumber()
  countedStock: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateInventoryCountItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryCountItemUpdateDto)
  items: InventoryCountItemUpdateDto[];
}

export class ApplyInventoryCountDto {
  @IsOptional()
  @IsString()
  approvedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelInventoryCountDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
