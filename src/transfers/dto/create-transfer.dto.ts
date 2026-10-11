import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TransferItemDto {
  @IsNotEmpty()
  @IsString()
  productCode!: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsNumber()
  quantity!: number;
}

export class CreateTransferDto {
  @IsNotEmpty()
  @IsString()
  fromStoreCode!: string;

  @IsNotEmpty()
  @IsString()
  toStoreCode!: string;

  @IsOptional()
  @IsString()
  requestedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items!: TransferItemDto[];
}

export class DispatchTransferItemDto {
  @IsNotEmpty()
  @IsString()
  productCode!: string;

  @IsNumber()
  quantity!: number;
}

export class DispatchTransferDto {
  @IsOptional()
  @IsString()
  dispatchedBy?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispatchTransferItemDto)
  items?: DispatchTransferItemDto[];
}

export class ReceiveTransferItemDto {
  @IsNotEmpty()
  @IsString()
  productCode!: string;

  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiveTransferDto {
  @IsOptional()
  @IsString()
  receivedBy?: string;

  @IsOptional()
  @IsString()
  discrepancyReason?: string;

  @IsOptional()
  @IsString()
  discrepancyNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveTransferItemDto)
  items?: ReceiveTransferItemDto[];
}

export class CancelTransferDto {
  @IsOptional()
  @IsString()
  cancelledBy?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
