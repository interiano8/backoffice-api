export interface ShiftEntity {
  id: string;
  source: string;
  storeCode: string;
  shiftDate: Date;
  shiftNo: string;
  employeeName: string;
  startTime?: Date | null;
  endTime?: Date | null;
  status?: string;
  totalSale?: number;
  totalDiscount?: number;
  reconcilerShiftId?: string | null;
  posCodes?: string | null;
  fsShiftIds?: string | null;
  isPresented?: boolean;
  isBalanced?: boolean;
  cashDeclared?: number | null;
  cardDeclared?: number | null;
  otherDeclared?: number | null;
  presentationDate?: Date | null;
  presentationDetails?: string | null;
  presentationComment?: string | null;
  invoiceCashCount?: number;
  invoiceCreditCount?: number;
  creditNoteCount?: number;
  outflowCount?: number;
}

export interface SaleEntity {
  id: string;
  source: string;
  storeCode: string;
  externalId: string;
  lineNo: number;
  timestamp: Date;
  shiftDate: Date;
  shiftNo: string;
  attendantName?: string;
  productName?: string;
  amount: number;
  volume?: number;
  unitPrice?: number;
  discount?: number;
  discountPct?: number;
  pumpId?: string;
  hoseId?: string;
  tankId?: string;
  unitOfMeasure?: string;
  reconcilerShiftId?: string;
  saleHeaderId?: string;
  docType?: number;
  customerName?: string;
  customerId?: string;
}

export interface SaleHeaderEntity {
  id: string;
  source: string;
  storeCode: string;
  transactionId: string;
  docType?: number;
  docNo?: string;
  shiftDate: Date;
  shiftNo: string;
  employeeName?: string;
  customerNo?: string;
  customerName?: string;
  rtn?: string;
  totalAmount?: number;
  subTotal?: number;
  reconcilerShiftId?: string;
  appliedDocNo?: string;
}

export interface PaymentMethodEntity {
  id: string;
  source: string;
  storeCode: string;
  transactionId?: string;
  shiftDate: Date;
  shiftNo?: string;
  employeeName?: string;
  chargeMethodCode?: string;
  description?: string;
  amount: number;
  esTicket?: boolean;
  reconcilerShiftId?: string;
  additionalData?: string;
  paymentCardNo?: string;
}
