export interface ICtrlUseCase {
  getRecentSales(storeCode: string, filters?: any): Promise<any>;
  getShiftValidation(storeCode: string, shiftId: string): Promise<any>;
}
