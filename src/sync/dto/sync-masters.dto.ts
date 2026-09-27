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

export interface SyncMasterProductDto {
  code: string;
  description: string;
  price: number;
  taxPct: number;
  unitOfMeasure: string;
  barcode?: string | null;
  category?: string | null;
  active: boolean;
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

export interface SyncMastersResponseDto {
  masterVersion: number;
  generatedAt: string;
  hasUpdates: boolean;
  customers: SyncMasterCustomerDto[];
  fuelPrices: SyncMasterFuelPriceDto[];
  products: SyncMasterProductDto[];
  discountRules?: SyncMasterDiscountRuleDto[];
}
