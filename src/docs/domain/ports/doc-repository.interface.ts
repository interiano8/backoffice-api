export interface DocFilters {
  shiftId?: string;
  startDate?: string;
  endDate?: string;
  docNo?: string;
  customerName?: string;
  docType?: string;
  staff?: string;
  posTerminal?: string;
  limit?: string;
  page?: string;
}

export interface DocumentRow {
  transactionId: string;
  docNo: string;
  docType: number;
  date: string;
  totalAmount: number;
  customerName: string;
  rtn: string;
  customerNo: string;
  billingType: number;
  placa: string;
  chofer: string;
  km: string;
  orden: string;
  staff: string;
  posTerminal: string;
  shiftNo: string;
  shiftDate: string;
  status: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    discountPct: number;
    amount: number;
    pumpId: string;
    hoseId: string;
    volumeLT: number;
    volumeGL: number;
  }>;
  payments: Array<{
    paymentMethod: string;
    description: string;
    amount: number;
  }>;
}

export interface DocsListResult {
  data: DocumentRow[];
  total: number;
}

export interface CustomerRow {
  customerNo: string;
  customerName: string;
  rtn: string;
  usualBillingType: number;
  blocked: number;
}

export interface ChargeMethodRow {
  code: string;
  description: string;
}

export interface UpdateDocumentData {
  docType: number;
  customerNo?: string;
  customerName?: string;
  rtn?: string;
  placa?: string;
  chofer?: string;
  km?: string;
  orden?: string;
  payments?: Array<{
    paymentMethod: string;
    description?: string;
    amount: number;
  }>;
}

export interface LealFilters {
  startShiftDate: string;
  endShiftDate: string;
  lealType?: number;
}

export interface DocRepository {
  getRecentDocuments(
    storeCode: string,
    filters: DocFilters,
  ): Promise<DocsListResult>;
  getLealDocuments(
    storeCode: string,
    filters: LealFilters,
  ): Promise<DocsListResult>;
  getCustomers(storeCode: string, search: string): Promise<CustomerRow[]>;
  getChargeMethods(storeCode: string): Promise<ChargeMethodRow[]>;
  getPosCodes(storeCode: string): Promise<string[]>;
  getUsers(storeCode: string): Promise<string[]>;
  getShiftCount(storeCode: string): Promise<number>;
  updateDocument(
    storeCode: string,
    transactionId: string,
    data: UpdateDocumentData,
  ): Promise<{ success: boolean; message: string }>;
}
