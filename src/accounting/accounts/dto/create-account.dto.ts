import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  COST = 'COST',
  EXPENSE = 'EXPENSE',
}

export enum AccountNature {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AccountType)
  type: string;

  @IsEnum(AccountNature)
  nature: string;

  @IsInt()
  @Min(1)
  @Max(5)
  level: number;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsBoolean()
  @IsOptional()
  allowsMovement?: boolean;
}
