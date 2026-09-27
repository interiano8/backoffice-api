import { ShiftEntity } from '../../shift.entity';

export interface IListShiftsUseCase {
  findAll(
    storeCode: string,
    date?: string,
    status?: string,
  ): Promise<ShiftEntity[]>;
  getUniqueDates(storeCode: string): Promise<Date[]>;
}
