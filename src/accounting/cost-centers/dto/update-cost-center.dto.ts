import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCostCenterDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  storeCode?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
