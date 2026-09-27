import { PrismaTanksRepository } from './prisma-tanks.repository';

describe('PrismaTanksRepository', () => {
  let repo: PrismaTanksRepository;
  let prisma: {
    tankMeasurement: { create: jest.Mock; findMany: jest.Mock };
    boHose: { findMany: jest.Mock };
  };

  const measurement = {
    storeCode: 'S01',
    shiftDate: new Date('2026-01-01T00:00:00Z'),
    shiftNo: '1',
    tankId: 'T1',
    measureType: 'DEPTH',
    height: 10,
    volume: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      tankMeasurement: {
        create: jest.fn().mockResolvedValue(measurement),
        findMany: jest.fn().mockResolvedValue([measurement]),
      },
      boHose: { findMany: jest.fn().mockResolvedValue([]) },
    };
    repo = new PrismaTanksRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('createMeasurement', () => {
    it('should create a measurement with a parsed date', async () => {
      const data = {
        storeCode: 'S01',
        shiftDate: '2026-01-01',
        shiftNo: '1',
        tankId: 'T1',
        measureType: 'DEPTH',
        height: 10,
        volume: 100,
        waterLevel: 2,
        temperature: 25,
      };
      await expect(repo.createMeasurement(data)).resolves.toEqual(measurement);
      expect(prisma.tankMeasurement.create).toHaveBeenCalledWith({
        data: {
          storeCode: 'S01',
          shiftDate: new Date('2026-01-01'),
          shiftNo: '1',
          tankId: 'T1',
          measureType: 'DEPTH',
          height: 10,
          volume: 100,
          waterLevel: 2,
          temperature: 25,
        },
      });
    });
  });

  describe('getMeasurements', () => {
    it('should find measurements without shiftNo', async () => {
      await expect(repo.getMeasurements('S01', '2026-01-01')).resolves.toEqual([
        measurement,
      ]);
      expect(prisma.tankMeasurement.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01', shiftDate: new Date('2026-01-01') },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by shiftNo when provided', async () => {
      await expect(repo.getMeasurements('S01', '2026-01-01', '1')).resolves.toEqual([
        measurement,
      ]);
      expect(prisma.tankMeasurement.findMany).toHaveBeenCalledWith({
        where: {
          storeCode: 'S01',
          shiftDate: new Date('2026-01-01'),
          shiftNo: '1',
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getAvailableTanks', () => {
    it('should map distinct tanks filtering null tankIds', async () => {
      prisma.boHose.findMany.mockResolvedValue([
        { tankId: 'T1', gradeName: 'Regular' },
        { tankId: 'T2', gradeName: null },
        { tankId: null, gradeName: 'Ignored' },
      ]);

      await expect(repo.getAvailableTanks('S01')).resolves.toEqual([
        { tankId: 'T1', gradeName: 'Regular' },
        { tankId: 'T2', gradeName: 'Desconocido' },
      ]);
      expect(prisma.boHose.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01', active: true, tankId: { not: null } },
        select: { tankId: true, gradeName: true },
        distinct: ['tankId'],
      });
    });
  });
});