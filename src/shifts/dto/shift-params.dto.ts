import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class StoreCodeHeader {
  @IsString()
  @IsNotEmpty()
  'x-store-code': string;
}

export class DateRangeQuery {
  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class ShiftDateParams {
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  shiftNo: string;
}
