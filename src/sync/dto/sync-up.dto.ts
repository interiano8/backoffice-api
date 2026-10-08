import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SyncSaleLineDto {
  @IsNumber()
  lineNo: number;

  @IsString()
  @IsNotEmpty()
  externalId: string;

  @IsOptional()
  @IsString()
  saleIdFusion?: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @IsOptional()
  @IsString()
  shiftNo?: string;

  @IsOptional()
  @IsString()
  shiftDate?: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsNumber()
  volume?: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  pumpId?: string;

  @IsOptional()
  @IsString()
  hoseId?: string;

  @IsOptional()
  @IsString()
  tankId?: string;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsNumber()
  discountPct?: number;
}

export class SyncSalePaymentDto {
  @IsNumber()
  chargeLineNo: number;

  @IsString()
  @IsNotEmpty()
  chargeMethodCode: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  paymentCardNo?: string;

  @IsOptional()
  @IsString()
  additionalData?: string;

  @IsOptional()
  @IsBoolean()
  esTicket?: boolean;
}

export class SyncSaleDto {
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @IsNumber()
  docType: number;

  @IsString()
  @IsNotEmpty()
  docNo: string;

  @IsOptional()
  @IsString()
  appliedDocNo?: string;

  @IsString()
  @IsNotEmpty()
  shiftDate: string;

  @IsString()
  @IsNotEmpty()
  shiftNo: string;

  @IsString()
  @IsNotEmpty()
  employeeName: string;

  @IsOptional()
  @IsString()
  customerNo?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  rtn?: string;

  @IsNumber()
  subTotal: number;

  @IsNumber()
  totalAmount: number;

  @IsOptional()
  @IsString()
  km?: string;

  @IsOptional()
  @IsString()
  orden?: string;

  @IsOptional()
  @IsString()
  placa?: string;

  @IsOptional()
  @IsString()
  chofer?: string;

  @IsOptional()
  @IsString()
  reconcilerShiftId?: string;

  @IsOptional()
  @IsString()
  creditValidationSource?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncSaleLineDto)
  lines: SyncSaleLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncSalePaymentDto)
  payments: SyncSalePaymentDto[];
}

export class SyncShiftControlTotalsDto {
  @IsOptional()
  @IsNumber()
  totalSalesCount?: number;

  @IsOptional()
  @IsNumber()
  totalSalesAmount?: number;

  @IsOptional()
  @IsString()
  firstTransactionId?: string;

  @IsOptional()
  @IsString()
  lastTransactionId?: string;
}

export class SyncShiftDto {
  @IsString()
  @IsNotEmpty()
  shiftDate: string;

  @IsString()
  @IsNotEmpty()
  shiftNo: string;

  @IsString()
  @IsNotEmpty()
  employeeName: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsNumber()
  totalSale: number;

  @IsNumber()
  totalDiscount: number;

  @IsOptional()
  @IsNumber()
  cashDeclared?: number;

  @IsOptional()
  @IsNumber()
  cardDeclared?: number;

  @IsOptional()
  @IsNumber()
  otherDeclared?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => SyncShiftControlTotalsDto)
  controlTotals?: SyncShiftControlTotalsDto;
}

export class SyncUpDto {
  @IsString()
  @IsNotEmpty()
  storeCode: string;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsString()
  @IsNotEmpty()
  sentAt: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncSaleDto)
  sales: SyncSaleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncShiftDto)
  shifts?: SyncShiftDto[];

  @IsOptional()
  @IsNumber()
  queueCount?: number;
}
