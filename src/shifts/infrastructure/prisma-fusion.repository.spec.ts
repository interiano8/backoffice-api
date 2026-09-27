import { PrismaFusionRepository } from './prisma-fusion.repository';

describe('PrismaFusionRepository', () => {
  let repo: PrismaFusionRepository;
  let prisma: {
    boShift: { findMany: jest.Mock };
    boPaymentMethod: { findMany: jest.Mock };
    boSale: { findMany: jest.Mock };
    boHose: { findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      boShift: { findMany: jest.fn().mockResolvedValue([]) },
      boPaymentMethod: { findMany: jest.fn().mockResolvedValue([]) },
      boSale: { findMany: jest.fn().mockResolvedValue([]) },
      boHose: { findMany: jest.fn().mockResolvedValue([]) },
    };
    repo = new PrismaFusionRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('findShiftsByReconcilerIds', () => {
    it('should find shifts by reconciler ids with selection', async () => {
      const shift = { reconcilerShiftId: 'r-1', shiftNo: '1' };
      prisma.boShift.findMany.mockResolvedValue([shift]);
      await expect(repo.findShiftsByReconcilerIds('S01', ['r-1'])).resolves.toEqual([
        shift,
      ]);
      expect(prisma.boShift.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01', reconcilerShiftId: { in: ['r-1'] } },
        select: {
          reconcilerShiftId: true,
          shiftNo: true,
          shiftDate: true,
          employeeName: true,
          isPresented: true,
          presentationDetails: true,
        },
      });
    });
  });

  describe('findPaymentMethodsByCriteria', () => {
    it('should find payment methods matching OR criteria', async () => {
      const criteria = [{ shiftDate: new Date('2026-01-01') }];
      const pm = { storeCode: 'S01', amount: 10 };
      prisma.boPaymentMethod.findMany.mockResolvedValue([pm]);
      await expect(
        repo.findPaymentMethodsByCriteria('S01', criteria),
      ).resolves.toEqual([pm]);
      expect(prisma.boPaymentMethod.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01', OR: criteria },
      });
    });
  });

  describe('findSalesByCriteria', () => {
    it('should find sales matching OR criteria with selection', async () => {
      const criteria = [{ shiftNo: '1' }];
      const sale = { productName: 'GAS', amount: 5, volume: 1 };
      prisma.boSale.findMany.mockResolvedValue([sale]);
      await expect(repo.findSalesByCriteria('S01', criteria)).resolves.toEqual([
        sale,
      ]);
      expect(prisma.boSale.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01', OR: criteria },
        select: {
          productName: true,
          amount: true,
          volume: true,
          shiftNo: true,
          shiftDate: true,
          reconcilerShiftId: true,
        },
      });
    });
  });

  describe('findHosesByStore', () => {
    it('should find hoses for a store', async () => {
      const hose = { storeCode: 'S01', pumpId: 1 };
      prisma.boHose.findMany.mockResolvedValue([hose]);
      await expect(repo.findHosesByStore('S01')).resolves.toEqual([hose]);
      expect(prisma.boHose.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
      });
    });
  });

  describe('findShiftsByCriteria', () => {
    it('should find shifts matching OR criteria with selection', async () => {
      const criteria = [{ shiftDate: new Date('2026-01-01'), shiftNo: '2' }];
      const shift = { reconcilerShiftId: 'r-2' };
      prisma.boShift.findMany.mockResolvedValue([shift]);
      await expect(repo.findShiftsByCriteria('S01', criteria)).resolves.toEqual([
        shift,
      ]);
      expect(prisma.boShift.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01', OR: criteria },
        select: {
          reconcilerShiftId: true,
          shiftNo: true,
          shiftDate: true,
          employeeName: true,
          isPresented: true,
          presentationDetails: true,
        },
      });
    });
  });
});
