export class CreatePaymentMethodDto {
  description: string;
  category?: string;
  currency?: string;
  generatesChange?: boolean;
  invoiceCash?: boolean;
  invoiceCredit?: boolean;
  fuelOutflow?: boolean;
  loyalty?: boolean;
  requiresReference?: boolean;
  image?: string;
  active?: boolean;
  accountId?: string;
  commissionPct?: number;
  storeCodes?: string[];
}
