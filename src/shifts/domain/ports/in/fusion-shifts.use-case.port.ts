export interface IFusionShiftsUseCase {
  getFusionShiftDetails(storeCode: string, fsShiftIds: string): Promise<any>;
  getUnifiedPayments(storeCode: string, fsShiftIds: string): Promise<any>;
  getUnifiedProducts(storeCode: string, fsShiftIds: string): Promise<any>;
  getAvailableDates(storeCode: string, limit?: number): Promise<string[]>;
  getShiftsByDate(storeCode: string, date: string): Promise<any[]>;
  auditShift(id: string, auditData: any): Promise<any>;
}
