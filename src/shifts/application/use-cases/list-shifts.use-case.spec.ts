import { ListShiftsUseCase } from './list-shifts.use-case';
import type { ShiftRepository } from '../../domain/ports/shift-repository.interface';
import type { ShiftEntity } from '../../domain/shift.entity';

describe('ListShiftsUseCase', () => {
  let useCase: ListShiftsUseCase;
  let mockRepo: jest.Mocked<ShiftRepository>;

  const mockShift: ShiftEntity = {
    id: 's-1',
    source: 'TPV',
    storeCode: 'STORE01',
    shiftDate: new Date('2026-08-31'),
    shiftNo: '1',
    employeeName: 'Juan Perez',
    status: 'CLOSED',
    totalSale: 52000,
    isPresented: true,
  };

  beforeEach(() => {
    mockRepo = {
      findShifts: jest.fn().mockResolvedValue([mockShift]),
      getUniqueDates: jest.fn().mockResolvedValue([new Date('2026-08-31')]),
      findShiftDetails: jest.fn().mockResolvedValue(null),
    } as any;
    useCase = new ListShiftsUseCase(mockRepo);
  });

  it('should list shifts by storeCode, date, and status', async () => {
    const result = await useCase.findAll('STORE01', '2026-08-31', 'CLOSED');
    expect(mockRepo.findShifts).toHaveBeenCalledWith('STORE01', '2026-08-31', 'CLOSED');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s-1');
  });

  it('should get unique shift dates', async () => {
    const result = await useCase.getUniqueDates('STORE01');
    expect(mockRepo.getUniqueDates).toHaveBeenCalledWith('STORE01');
    expect(result).toHaveLength(1);
  });
});
