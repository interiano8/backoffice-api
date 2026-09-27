import { PresentationResult } from '../presentation-repository.interface';

export interface IPresentShiftUseCase {
  getExpectedShiftPresentation(
    storeCode: string,
    shiftDate: string,
    shiftNo: string,
    employeeName: string,
  ): Promise<PresentationResult>;

  saveShiftPresentation(
    storeCode: string,
    data: any,
  ): Promise<PresentationResult>;

  printShiftReport(
    storeCode: string,
    shiftDate: string,
    shiftNo: string,
    employeeName: string,
    printedBy: string,
    details: any,
  ): Promise<PresentationResult>;
}
