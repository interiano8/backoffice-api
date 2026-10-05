export class CreateExchangeRateDto {
  currency?: string;
  rate: number;
  startDate: string;
  endDate?: string;
  active?: boolean;
}
