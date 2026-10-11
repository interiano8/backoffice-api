import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
} from 'class-validator';

export class UpdatePaymentMethodDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  generatesChange?: boolean;

  @IsBoolean()
  @IsOptional()
  invoiceCash?: boolean;

  @IsBoolean()
  @IsOptional()
  invoiceCredit?: boolean;

  @IsBoolean()
  @IsOptional()
  fuelOutflow?: boolean;

  @IsBoolean()
  @IsOptional()
  loyalty?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresReference?: boolean;

  @IsString()
  @IsOptional()
  image?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsOptional()
  accountId?: string;

  @IsNumber()
  @IsOptional()
  commissionPct?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  storeCodes?: string[];
}
