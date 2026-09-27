export interface IGetShiftDetailsUseCase {
  getShiftDetails(
    storeCode: string,
    date: string,
    shiftNo: string,
    attendantName?: string,
  ): Promise<any>;
}
