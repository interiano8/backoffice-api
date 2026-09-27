import { Injectable, Inject, Logger } from '@nestjs/common';
import { IListShiftsUseCase } from '../../domain/ports/in/list-shifts.use-case.port';
import type { ShiftRepository } from '../../domain/ports/shift-repository.interface';
import { ShiftEntity } from '../../domain/shift.entity';

@Injectable()
export class ListShiftsUseCase implements IListShiftsUseCase {
  private readonly logger = new Logger(ListShiftsUseCase.name);

  constructor(
    @Inject('ShiftRepository')
    private readonly shiftRepo: ShiftRepository,
  ) {}

  async findAll(
    storeCode: string,
    date?: string,
    status?: string,
  ): Promise<ShiftEntity[]> {
    return this.shiftRepo.findShifts(storeCode, date, status);
  }

  async getUniqueDates(storeCode: string): Promise<Date[]> {
    return this.shiftRepo.getUniqueDates(storeCode);
  }
}
