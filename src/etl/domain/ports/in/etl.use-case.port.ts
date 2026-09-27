import type { HoseConfiguration } from '../etl-repository.interface';

export interface IEtlUseCase {
  syncSales(storeCode: string): Promise<{ success: boolean; message?: string; error?: string }>;
  syncByReconcilerShiftId(storeCode: string, reconcilerShiftId: string): Promise<{ success: boolean; message?: string; error?: string }>;
  syncMultipleShifts(storeCode: string, reconcilerShiftIds: string[]): Promise<{
    success: boolean;
    results?: Array<{ reconcilerShiftId: string; success: boolean; message?: string; error?: string }>;
    synced?: number;
    errors?: number;
    error?: string;
  }>;
  getHoseConfiguration(storeCode: string): Promise<HoseConfiguration>;
}
