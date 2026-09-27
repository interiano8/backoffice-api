import { ShiftEntity } from '../shift.entity';

export interface PresentationDetail {
  name: string;
  expected: number;
  declared: number;
  difference: number;
  type: string;
  raw: unknown | null;
}

export interface PresentationTotals {
  cash: number;
  card: number;
  other: number;
  total: number;
}

export interface PresentationExpected {
  list: PresentationDetail[];
  totals: PresentationTotals;
}

export interface PresentationData {
  storeCode: string;
  shiftDate: string;
  shiftNo: string;
  employeeName: string;
  details: PresentationDetail[];
  comment?: string;
}

export interface PrintDetails {
  stationName: string;
  [key: string]: unknown;
}

export interface PresentationResult {
  success: boolean;
  error?: string;
  isBalanced?: boolean;
  expected?: PresentationExpected;
  differences?: PresentationTotals;
  systemTotals?: { cash: number; card: number; other: number };
  declared?: { cash: number; card: number; other: number };
  details?: PresentationDetail[];
  shift?: ShiftEntity;
  version?: number;
  printedBy?: string;
  printedAt?: Date;
  stationName?: string;
}

export interface PresentationRepository {
  getExpectedShiftPresentation(
    storeCode: string,
    shiftDate: string,
    shiftNo: string,
    employeeName: string,
  ): Promise<PresentationResult>;
  saveShiftPresentation(
    storeCode: string,
    data: PresentationData,
  ): Promise<PresentationResult>;
  printShiftReport(
    storeCode: string,
    shiftDate: string,
    shiftNo: string,
    employeeName: string,
    printedBy: string,
    details: PrintDetails,
  ): Promise<PresentationResult>;
}
