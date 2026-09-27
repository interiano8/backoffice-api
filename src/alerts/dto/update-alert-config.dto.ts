import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateAlertConfigDto {
  @IsOptional()
  recipientEmails?: string[] | string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cashVarianceThreshold?: number;

  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  shiftDiscrepancyEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  fiscalGapEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  offlineStoreEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  offlineMinutesThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cooldownMinutes?: number;
}
