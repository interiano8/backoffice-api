import { IsNotEmpty, IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class HeartbeatDto {
  @IsNotEmpty()
  @IsString()
  storeCode!: string;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ONLINE', 'OFFLINE', 'UNKNOWN'])
  fusionStatus?: string;

  @IsOptional()
  @IsNumber()
  pendingSyncCount?: number;

  @IsOptional()
  @IsString()
  posVersion?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
