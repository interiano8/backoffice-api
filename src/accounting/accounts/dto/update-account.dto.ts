import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  allowsMovement?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
