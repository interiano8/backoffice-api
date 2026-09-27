import type { DbExecutor } from '../../../common/connections/db-executor.interface';

export interface HoseMapValue {
  unit: string;
  grade: string;
  tankId: string;
  hoseId: number;
}

export interface ProductMapValue {
  unit: string;
  standardName: string;
}

export interface HoseConfiguration {
  hoseMap: Record<string, HoseMapValue>;
  productMap: Record<string, ProductMapValue>;
}

export interface EtlRepository {
  getHoseConfiguration(storeCode: string): Promise<HoseConfiguration>;
  syncHoses(pool: DbExecutor, storeCode: string): Promise<void>;
  syncPaymentMethods(
    pool: DbExecutor,
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void>;
  syncTpvSales(
    pool: DbExecutor,
    storeCode: string,
    configMaps?: HoseConfiguration,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void>;
  syncTpvShifts(
    pool: DbExecutor,
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void>;
  syncSaleHeaders(
    pool: DbExecutor,
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void>;
  updateShiftTotals(
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void>;
}
