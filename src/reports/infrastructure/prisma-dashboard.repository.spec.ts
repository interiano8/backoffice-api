import { PrismaDashboardRepository } from './prisma-dashboard.repository';

describe('PrismaDashboardRepository', () => {
  let repo: PrismaDashboardRepository;
  let prisma: {
    boStore: { findMany: jest.Mock };
    boSale: { findMany: jest.Mock };
    boSaleHeader: { findMany: jest.Mock };
    boPaymentMethod: { findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      boStore: { findMany: jest.fn().mockResolvedValue([]) },
      boSale: { findMany: jest.fn().mockResolvedValue([]) },
      boSaleHeader: { findMany: jest.fn().mockResolvedValue([]) },
      boPaymentMethod: { findMany: jest.fn().mockResolvedValue([]) },
    };
    repo = new PrismaDashboardRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('getDashboardStats', () => {
    it('should delegate to global stats when storeCode is GLOBAL', async () => {
      prisma.boStore.findMany.mockResolvedValue([
        { code: 'S01', name: 'Store 1', titulo: 'T' },
      ]);
      prisma.boSale.findMany.mockResolvedValue([
        {
          amount: 100,
          volume: 3.78541,
          productName: 'REGULAR',
          storeCode: 'S01',
          shiftDate: new Date('2026-01-15T00:00:00Z'),
          timestamp: new Date('2026-01-15T10:00:00Z'),
        },
        {
          amount: 50,
          volume: 3.78541,
          productName: undefined,
          storeCode: 'S99',
          shiftDate: null,
          timestamp: null,
        },
        {
          amount: '25',
          volume: '3.78541',
          productName: '  premium ',
          storeCode: 'S01',
          shiftDate: new Date('2026-01-15T00:00:00Z'),
          timestamp: new Date('2026-01-15T22:30:00Z'),
        },
      ]);
      prisma.boSaleHeader.findMany.mockResolvedValue([
        { storeCode: 'S01' },
        { storeCode: 'S01' },
      ]);
      prisma.boPaymentMethod.findMany.mockResolvedValue([
        { description: 'EFECTIVO', amount: 100 },
        { description: '  TARJETA  ', amount: 50 },
        { description: null, amount: 10 },
      ]);

      const result = await repo.getDashboardStats('GLOBAL', 15, '2026-01-15');

      expect(result.totalAmount).toBe(175);
      expect(result.totalVolumeGL).toBe(3);
      expect(result.totalTransactions).toBe(2);
      expect(result.activeStoresCount).toBe(1);
      expect(result.storeRanking[0]).toEqual({
        storeCode: 'S01',
        storeName: 'Store 1',
        totalAmount: 125,
        totalVolumeGL: 2,
        transactionCount: 2,
      });
      expect(result.storeRanking[1].storeName).toBe('Tienda S99');
      expect(result.products.map((p: any) => p.name)).toEqual([
        'REGULAR',
        'OTROS',
        'PREMIUM',
      ]);
      expect(result.paymentMethods.map((p: any) => p.name)).toEqual([
        'EFECTIVO',
        'TARJETA',
        'OTRO',
      ]);
      expect(result.dailySales[0].date).toBe('2026-01-15');
      expect(result.dailySales[1].date).toBe('Sin Fecha');
      expect(result.hourlyTraffic).toHaveLength(24);
      const hour10Key = `${new Date('2026-01-15T10:00:00Z')
        .getHours()
        .toString()
        .padStart(2, '0')}:00`;
      const hour10 = result.hourlyTraffic.find((h: any) => h.hour === hour10Key);
      expect(hour10.amount).toBe(100);
      expect(hour10.volume).toBe(1);
      expect(prisma.boSale.findMany).toHaveBeenCalledWith({
        where: {
          shiftDate: {
            gte: new Date('2026-01-15T00:00:00.000Z'),
            lte: new Date('2026-01-15T23:59:59.999Z'),
          },
        },
      });
    });

    it('should delegate to global stats when storeCode is missing', async () => {
      prisma.boStore.findMany.mockResolvedValue([{ code: 'S01', name: 'S1' }]);

      const result = await repo.getDashboardStats('' as any);

      expect(result.activeStoresCount).toBe(1);
    });

    it('should aggregate bo sales when present', async () => {
      prisma.boSale.findMany.mockResolvedValue([
        {
          volume: 3.78541,
          amount: 100,
          productName: 'REGULAR',
          attendantName: 'Juan',
          pumpId: '1',
          shiftDate: new Date('2026-01-15T00:00:00Z'),
          timestamp: new Date('2026-01-15T10:00:00Z'),
        },
        {
          volume: 0,
          amount: 0,
          productName: null,
          attendantName: null,
          pumpId: '0',
          shiftDate: null,
          timestamp: null,
        },
        {
          volume: 3.78541,
          amount: 50,
          productName: 'REGULAR',
          attendantName: 'Juan',
          pumpId: '1',
          shiftDate: new Date('2026-01-16T00:00:00Z'),
          timestamp: new Date('2026-01-16T10:30:00Z'),
        },
      ]);
      prisma.boPaymentMethod.findMany.mockResolvedValue([
        { description: 'EFECTIVO', amount: 150 },
      ]);

      const result = await repo.getDashboardStats('S01', 15, '2026-01-15');

      expect(result.totalVolume).toBe(7.57082);
      expect(result.totalAmount).toBe(150);
      expect(result.totalVolumeGL).toBe(2);
      expect(result.products).toHaveLength(2);
      expect(result.attendants).toHaveLength(2);
      expect(result.pumps).toHaveLength(1);
      expect(result.hourly).toHaveLength(24);
      expect(result.paymentMethods).toHaveLength(1);
      expect(result.dailyVolume).toHaveLength(3);
      expect(prisma.boPaymentMethod.findMany).toHaveBeenCalledWith({
        where: {
          storeCode: 'S01',
          shiftDate: {
            gte: new Date('2026-01-15T00:00:00.000Z'),
            lte: new Date('2026-01-15T23:59:59.999Z'),
          },
        },
      });
    });

    it('should return empty tpv stats when no bo sales exist', async () => {
      const result = await repo.getDashboardStats('S01', 15, '2026-01-15');

      expect(result).toEqual({
        products: [],
        dailyVolume: [],
        attendants: [],
        pumps: [],
        paymentMethods: [],
        hourly: [],
        topCustomers: [],
        totalVolume: 0,
        totalVolumeLT: 0,
        totalVolumeGL: 0,
        totalAmount: 0,
      });
    });
  });

  describe('getMonthlyAnalysis', () => {
    it('should return the monthly comparison skeleton', async () => {
      const result = await repo.getMonthlyAnalysis(
        'S01',
        '2026-01-01',
        '2026-01-15',
        '2025-12-01',
        '2025-12-15',
      );

      expect(result.period1.label).toBe('2026-01-01 al 2026-01-15');
      expect(result.period2.label).toBe('2025-12-01 al 2025-12-15');
      expect(result.period1.contado).toBe(0);
      expect(result.discountComparison).toEqual({
        current: 0,
        previous: 0,
        difference: 0,
        percentChange: 0,
      });
      expect(result.fuelGrowth).toEqual([]);
    });
  });
});