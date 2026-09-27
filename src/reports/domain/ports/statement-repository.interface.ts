import { CustomerStatementRow } from './report-repository.interface';

export interface StatementRawRow {
  customerNo: string;
  customerName: string;
  rtn: string;
  docNo: string;
  docType: number;
  date: Date;
  amount: number;
  billingType: number;
  productDetails: string;
  fleetInfo: string;
}

export interface StatementRepository {
  getActiveCustomers(
    startDate: string,
    endDate: string,
    storeCode?: string,
  ): Promise<{ customerNo: string; customerName: string }[]>;
  getStoreUnitMappings(storeCode?: string): Promise<Record<string, string>>;
  getStoreShowDetails(storeCode: string): Promise<boolean>;
  getCustomerStatementRaw(
    startDate: string,
    endDate: string,
    customerNo: string,
    storeCode?: string,
  ): Promise<StatementRawRow[]>;
  getAllStatementsRaw(
    startDate: string,
    endDate: string,
  ): Promise<StatementRawRow[]>;
  processStatements(
    statements: StatementRawRow[],
    showDetails?: boolean,
    unitMappings?: Record<string, string>,
  ): CustomerStatementRow[];
}
