import { TanksUseCase } from './tanks.use-case';
import type { TanksRepository } from '../../domain/ports/tanks-repository.interface';
import { TankMeasurement } from '@prisma/client';

describe('TanksUseCase', () => {
  let useCase: TanksUseCase;
  let mockRepo: jest.Mocked<TanksRepository>;

  const mockMeasurement = {
    id: 'm-1',
    storeCode: 'STORE01',
    shiftDate: new Date('2026-08-31'),
    shiftNo: '1',
    tankId: 'T1',
    measureType: 'OPENING',
    height: 1500,
    volume: 12000,
    waterLevel: 0,
    temperature: 25,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TankMeasurement;

  beforeEach(() => {
    mockRepo = {
      createMeasurement: jest.fn().mockResolvedValue(mockMeasurement),
      getMeasurements: jest.fn().mockResolvedValue([mockMeasurement]),
      getAvailableTanks: jest.fn().mockResolvedValue([{ tankId: 'T1', gradeName: 'Regular' }]),
    };
    useCase = new TanksUseCase(mockRepo);
  });

  it('should create a tank measurement', async () => {
    const data = {
      storeCode: 'STORE01',
      shiftDate: '2026-08-31',
      shiftNo: '1',
      tankId: 'T1',
      measureType: 'OPENING',
      height: 1500,
      volume: 12000,
    };

    const result = await useCase.createMeasurement(data);
    expect(mockRepo.createMeasurement).toHaveBeenCalledWith(data);
    expect(result).toEqual(mockMeasurement);
  });

  it('should list measurements by store, date, and shift', async () => {
    const result = await useCase.getMeasurements('STORE01', '2026-08-31', '1');
    expect(mockRepo.getMeasurements).toHaveBeenCalledWith('STORE01', '2026-08-31', '1');
    expect(result).toHaveLength(1);
  });

  it('should list available tanks for a store', async () => {
    const result = await useCase.getAvailableTanks('STORE01');
    expect(mockRepo.getAvailableTanks).toHaveBeenCalledWith('STORE01');
    expect(result).toEqual([{ tankId: 'T1', gradeName: 'Regular' }]);
  });
});
