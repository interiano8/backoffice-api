export interface CtrlFilters {
  shiftId?: string;
  startDate?: string;
  endDate?: string;
  saleId?: string;
  posNumber?: string;
  pumpNumber?: string;
  minAmount?: string;
  maxAmount?: string;
  limit?: string;
  page?: string;
}

export interface CtrlFusionSaleRow {
  SaleID: string;
  PosNumber: number;
  PumpNumber: number;
  HoseNumber: number;
  Amount: number;
  PPU: number;
  Volume: number;
  FinalVolumeTotal: number;
  InitialVolumeTotal: number;
  CompensatedTemperature: number;
  ShiftID: number;
  GradeNr: number;
  PriceLevel: number;
  TypeOfTransaction: number;
  DateOfTransaction: string;
  TimeOfTransaction: string;
  PresetAmount: number;
  IsInvoiced: boolean;
  productName: string;
  formattedDateTime: string;
  displayPos: string | number;
}

export interface ShiftValidationResult {
  netSales: number;
  discounts: number;
  creditNotes: number;
  tickets: number;
  grossSales: number;
  calculatedTotal: number;
}

export interface CtrlRepository {
  getRecentSales(
    storeCode: string,
    filters?: CtrlFilters,
  ): Promise<CtrlFusionSaleRow[]>;
  getShiftValidation(
    storeCode: string,
    shiftId: string,
  ): Promise<ShiftValidationResult>;
}
