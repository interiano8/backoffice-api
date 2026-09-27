export interface CustomerStatementRow {
  docNo: string;
  docType: number;
  date: Date;
  amount: number;
  charge: number;
  payment: number;
  balance: number;
  customerName: string;
  rtn: string;
  productDetails: string;
  fleetInfo: string;
}

export interface SalesDeclarationRow {
  date: Date;
  docNo: string;
  docType: number;
  exempt: number;
  taxed15: number;
  taxed18: number;
  tax15: number;
  tax18: number;
  total: number;
  pos: string;
  rangeNo: string;
  rangeFrom: string;
  rangeTo: string;
  cai: string;
  rangeDueDate: string;
  desde: string;
  hasta: string;
  docs: number;
}

export interface ActiveCustomerRow {
  customerNo: string;
  customerName: string;
  rtn: string;
}

export interface ReportRepository {
  getCustomerStatement(
    startDate: string,
    endDate: string,
    customerNo: string,
    storeCode?: string,
  ): Promise<CustomerStatementRow[]>;
  getBulkCustomerStatements(
    startDate: string,
    endDate: string,
    storeCode?: string,
  ): Promise<Record<string, CustomerStatementRow[]>>;
  getSalesDeclaration(
    startDate: string,
    endDate: string,
    type: 'resumido' | 'detallado',
    storeCode?: string,
  ): Promise<SalesDeclarationRow[]>;
  getActiveCustomers(
    startDate: string,
    endDate: string,
    storeCode?: string,
  ): Promise<ActiveCustomerRow[]>;
  getStoreUnitMappings(storeCode?: string): Promise<Record<string, string>>;
}
