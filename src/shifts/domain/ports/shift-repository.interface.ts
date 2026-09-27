import {
  ShiftEntity,
  SaleEntity,
  SaleHeaderEntity,
  PaymentMethodEntity,
} from '../shift.entity';

export interface SaleWhere {
  storeCode?: string;
  shiftNo?: string;
  shiftDate?: Date | { gte: Date; lte: Date };
  attendantName?: string;
  reconcilerShiftId?: string;
  docType?: number;
  pumpId?: string;
  hoseId?: string;
}

export interface SaleHeaderWithLinesResult extends SaleHeaderEntity {
  lines?: Array<{
    id: string;
    amount: number;
    volume: number;
    unitPrice: number;
    productName: string;
    unitOfMeasure: string;
    pumpId: string;
    hoseId: string;
    tankId: string;
    saleIdFusion: string;
    discount: number;
    discountPct: number;
    docType: number;
    paymentType: string;
  }>;
  payments?: PaymentMethodEntity[];
}

export type PaymentMethodWhere = {
  storeCode?: string;
  shiftDate?: Date;
  shiftNo?: string;
  employeeName?: string;
  esTicket?: boolean;
  NOT?: { description?: { contains?: string } };
};

export interface ShiftRepository {
  findShifts(
    storeCode: string,
    date?: string,
    status?: string,
  ): Promise<ShiftEntity[]>;
  findShiftById(
    storeCode: string,
    shiftNo: string,
    shiftDate: Date,
    employeeName: string,
  ): Promise<ShiftEntity | null>;
  findSales(where: SaleWhere): Promise<SaleEntity[]>;
  findSaleHeadersWithLines(where: {
    where: {
      storeCode?: string;
      shiftDate?: Date;
      shiftNo?: string;
      employeeName?: string;
    };
    include?: {
      lines?: { select?: Record<string, boolean> };
      payments?: boolean;
    };
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<SaleHeaderWithLinesResult[]>;
  findSaleHeaders(where: {
    where?: {
      storeCode?: string;
      shiftDate?: Date;
      shiftNo?: string;
      employeeName?: string;
    };
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<SaleHeaderEntity[]>;
  countSaleHeaders(where: {
    where?: {
      storeCode?: string;
      shiftDate?: Date;
      shiftNo?: string;
      employeeName?: string;
    };
  }): Promise<number>;
  findPaymentMethods(where: PaymentMethodWhere): Promise<PaymentMethodEntity[]>;
  getShiftCounters(
    storeCode: string,
    shiftDate: Date,
    shiftNo: string,
  ): Promise<{
    invoiceCashCount: number;
    invoiceCreditCount: number;
    creditNoteCount: number;
    outflowCount: number;
  }>;
  getUniqueDates(storeCode: string): Promise<Date[]>;
  queryRawUnsafe(query: string, params?: unknown[]): Promise<unknown[]>;
}
