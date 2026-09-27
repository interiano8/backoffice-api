export interface IDocsUseCase {
  getRecentDocuments(storeCode: string, filters: any): Promise<any>;
  getLealDocuments(storeCode: string, filters: any): Promise<any>;
  getCustomers(storeCode: string, search: string): Promise<any>;
  getChargeMethods(storeCode: string): Promise<any>;
  getPosCodes(storeCode: string): Promise<any>;
  getUsers(storeCode: string): Promise<any>;
  getShiftCount(storeCode: string): Promise<any>;
  updateDocument(
    storeCode: string,
    transactionId: string,
    data: any,
  ): Promise<any>;
}
