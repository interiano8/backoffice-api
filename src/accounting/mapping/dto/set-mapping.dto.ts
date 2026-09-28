import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SetMappingDto {
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  sourceIdentifier: string;

  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsString()
  @IsOptional()
  costCenterId?: string;
}
