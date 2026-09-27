import { PaymentMethodEntity } from '../shift.entity';

export interface FusionHose {
  pumpId: string;
  hoseId: string;
  displayHose: string;
  productName: string;
  tpvVolume: number;
  tpvAmount: number;
  fusionVolume: number;
  fusionAmount: number;
  initialVolume: number;
  finalVolume: number;
  diffVolume: number;
  diffAmount: number;
}

export interface FusionHoseRecord {
  pumpId: number;
  hoseId: number;
  hosePhysicalId: number | null;
  gradeName: string;
  genericCode: string | null;
  unitOfMeasure: string | null;
  tankId: string | null;
  active: boolean;
}

export interface FusionShiftRecord {
  reconcilerShiftId: string | null;
  shiftNo: string;
  shiftDate: Date;
  employeeName: string;
  isPresented: boolean;
  presentationDetails: string | null;
}

export interface FusionSaleRecord {
  productName: string | null;
  amount: number;
  volume: number | null;
  shiftNo: string | null;
  shiftDate: Date | null;
  reconcilerShiftId: string | null;
}

export interface FusionCriteria {
  shiftDate?: Date;
  shiftNo?: string;
}

export interface FusionValidation {
  netSales: number;
  otherProductsSales: number;
  discounts: number;
  creditNotes: number;
  tickets: number;
  grossSales: number;
  calculatedTotal: number;
}

export interface FusionRepository {
  findHosesByStore(storeCode: string): Promise<FusionHoseRecord[]>;
  findShiftsByReconcilerIds(
    storeCode: string,
    ids: string[],
  ): Promise<FusionShiftRecord[]>;
  findPaymentMethodsByCriteria(
    storeCode: string,
    criteria: FusionCriteria[],
  ): Promise<PaymentMethodEntity[]>;
  findShiftsByCriteria(
    storeCode: string,
    criteria: FusionCriteria[],
  ): Promise<FusionShiftRecord[]>;
  findSalesByCriteria(
    storeCode: string,
    criteria: FusionCriteria[],
  ): Promise<FusionSaleRecord[]>;
}
