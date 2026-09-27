export interface ICustomerStatementUseCase {
  getActiveCustomers(
    startDate: string,
    endDate: string,
    storeCode?: string,
  ): Promise<any[]>;

  getStoreUnitMappings(storeCode?: string): Promise<any>;

  getCustomerStatement(
    startDate: string,
    endDate: string,
    customerNo: string,
    storeCode?: string,
  ): Promise<any>;

  getBulkCustomerStatements(
    startDate: string,
    endDate: string,
    storeCode?: string,
  ): Promise<Record<string, any[]>>;
}
