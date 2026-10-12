export interface SyncMasterCustomerDto {
  customerNo: string;
  customerName: string;
  rtn?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  billingType: number;
  blocked: boolean;
  creditLimit?: number | null;
  balance?: number | null;
}

export interface SyncMasterFuelPriceDto {
  gradeId: number;
  gradeName: string;
  unitPrice: number;
  effectiveDate: string;
}

export interface SyncMasterCategoryDto {
  code: string;
  description: string;
}

export interface SyncMasterBarcodeDto {
  productCode: string;
  barcode: string;
}

export interface SyncMasterProductPriceDto {
  productCode: string;
  storeCode?: string | null;
  unitPrice: number;
  startDate?: string | null;
  endDate?: string | null;
  currencyCode?: string;
  active: boolean;
}

export interface SyncMasterProductDto {
  code: string;
  description: string;
  price: number;
  taxPct: number;
  unitOfMeasure: string;
  barcode?: string | null;
  barcodes?: string[];
  category?: string | null;
  categoryCode?: string | null;
  departmentCode?: string | null;
  active: boolean;
  imageUrl?: string | null;
}

export interface SyncMasterDiscountRuleDto {
  id: string;
  codigoCliente?: string | null;
  codigoProducto?: string | null;
  codigoCategoria?: string | null;
  cantidadMinima?: number | null;
  tipoBeneficio: 'PORCENTAJE' | 'MONTO_FIJO' | 'MONTO_VOLUMEN';
  valor: number;
  unidadVolumen?: 'GALON' | 'LITRO' | null;
  prioridad: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  activo: boolean;
  acumulable?: boolean | null;
  idTienda?: string | null;
}

export interface SyncMasterUserDto {
  username: string;
  name: string;
  passwordHash: string;
  role: string;
  pin?: string | null;
  rfid?: string | null;
  active: boolean;
}

export interface SyncMasterPaymentMethodDto {
  code: string;
  description: string;
  category: string;
  currency: string;
  generatesChange: boolean;
  invoiceCash: boolean;
  invoiceCredit: boolean;
  fuelOutflow: boolean;
  loyalty: boolean;
  requiresReference: boolean;
  image?: string | null;
  active: boolean;
  accountId?: string | null;
  commissionPct?: number | null;
}

export interface SyncMasterExchangeRateDto {
  id: string;
  currency: string;
  rate: number;
  startDate: string;
  endDate?: string | null;
  active: boolean;
}

export interface SyncMastersResponseDto {
  masterVersion: number;
  generatedAt: string;
  hasUpdates: boolean;
  customers: SyncMasterCustomerDto[];
  fuelPrices: SyncMasterFuelPriceDto[];
  products: SyncMasterProductDto[];
  categories?: SyncMasterCategoryDto[];
  barcodes?: SyncMasterBarcodeDto[];
  productPrices?: SyncMasterProductPriceDto[];
  discountRules?: SyncMasterDiscountRuleDto[];
  users: SyncMasterUserDto[];
  paymentMethods?: SyncMasterPaymentMethodDto[];
  exchangeRates?: SyncMasterExchangeRateDto[];
}

