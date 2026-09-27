import { PrismaShiftRepository } from './prisma-shift.repository';

describe('PrismaShiftRepository', () => {
  let repo: PrismaShiftRepository;
  let prisma: {
    boShift: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
    boSale: { findMany: jest.Mock };
    boSaleHeader: { findMany: jest.Mock; count: jest.Mock };
    boPaymentMethod: { findMany: jest.Mock };
    $queryRawUnsafe: jest.Mock;
  };

  const shift = { id: 'shift-1', storeCode: 'S01', shiftNo: '1' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      boShift: {
        findMany: jest.fn().mockResolvedValue([shift]),
        findUnique: jest.fn().mockResolvedValue(shift),
        findFirst: jest.fn().mockResolvedValue({
          invoiceCashCount: 2,
          invoiceCreditCount: 3,
          creditNoteCount: 1,
          outflowCount: 0,
        }),
      },
      boSale: { findMany: jest.fn().mockResolvedValue([]) },
      boSaleHeader: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(5),
      },
      boPaymentMethod: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 1 }]),
    };
    repo = new PrismaShiftRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('findShifts', () => {
    it('should query without date or status filters', async () => {
      await expect(repo.findShifts('S01')).resolves.toEqual([shift]);
      expect(prisma.boShift.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
        orderBy: [{ shiftDate: 'desc' }, { shiftNo: 'desc' }],
        take: 2000,
      });
    });

    it('should add date range and status filters', async () => {
      await repo.findShifts('S01', '2026-08-31', 'CLOSED');
      const args = prisma.boShift.findMany.mock.calls[0][0];
      expect(args.where.storeCode).toBe('S01');
      expect(args.where.status).toBe('CLOSED');
      expect(args.where.shiftDate.gte).toEqual(
        new Date(new Date('2026-08-31').setHours(0, 0, 0, 0)),
      );
      expect(args.where.shiftDate.lte).toEqual(
        new Date(new Date('2026-08-31').setHours(23, 59, 59, 999)),
      );
    });
  });

  describe('findShiftById', () => {
    it('should find a shift by composite key', async () => {
      const shiftDate = new Date('2026-08-31');
      await expect(
        repo.findShiftById('S01', '1', shiftDate, 'Juan'),
      ).resolves.toEqual(shift);
      expect(prisma.boShift.findUnique).toHaveBeenCalledWith({
        where: {
          source_storeCode_shiftDate_shiftNo_employeeName: {
            source: 'TPV',
            storeCode: 'S01',
            shiftDate,
            shiftNo: '1',
            employeeName: 'Juan',
          },
        },
      });
    });
  });

  describe('findSales', () => {
    it('should wrap a raw where object', async () => {
      await repo.findSales({ storeCode: 'S01' });
      expect(prisma.boSale.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
      });
    });

    it('should pass through full query options', async () => {
      await repo.findSales({ where: { storeCode: 'S01' }, select: { id: true } });
      expect(prisma.boSale.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
        select: { id: true },
      });
    });
  });

  describe('findSaleHeadersWithLines', () => {
    it('should wrap a raw where object and include lines and payments', async () => {
      await repo.findSaleHeadersWithLines({ storeCode: 'S01' });
      const args = prisma.boSaleHeader.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ storeCode: 'S01' });
      expect(args.include.lines.select).toEqual(
        expect.objectContaining({ id: true, amount: true }),
      );
      expect(args.include.payments).toBe(true);
      expect(args.orderBy).toEqual({ docNo: 'asc' });
    });

    it('should spread existing options', async () => {
      await repo.findSaleHeadersWithLines({
        where: { storeCode: 'S01' },
        take: 10,
      });
      const args = prisma.boSaleHeader.findMany.mock.calls[0][0];
      expect(args.take).toBe(10);
      expect(args.where).toEqual({ storeCode: 'S01' });
    });
  });

  describe('findSaleHeaders', () => {
    it('should pass through full query options', async () => {
      await repo.findSaleHeaders({ where: { storeCode: 'S01' }, take: 5 });
      expect(prisma.boSaleHeader.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
        take: 5,
      });
    });

    it('should wrap a raw where object', async () => {
      await repo.findSaleHeaders({ storeCode: 'S01' });
      expect(prisma.boSaleHeader.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
      });
    });
  });

  describe('countSaleHeaders', () => {
    it('should count with passthrough options', async () => {
      await expect(repo.countSaleHeaders({ where: { storeCode: 'S01' } })).resolves.toBe(
        5,
      );
      expect(prisma.boSaleHeader.count).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
      });
    });

    it('should count with a wrapped where object', async () => {
      await expect(repo.countSaleHeaders({ storeCode: 'S01' })).resolves.toBe(5);
      expect(prisma.boSaleHeader.count).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
      });
    });
  });

  describe('findPaymentMethods', () => {
    it('should pass through full query options', async () => {
      await repo.findPaymentMethods({ where: { storeCode: 'S01' }, take: 2 });
      expect(prisma.boPaymentMethod.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
        take: 2,
      });
    });

    it('should wrap a raw where object', async () => {
      await repo.findPaymentMethods({ storeCode: 'S01' });
      expect(prisma.boPaymentMethod.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
      });
    });
  });

  describe('getShiftCounters', () => {
    it('should return the counters from the found shift', async () => {
      await expect(
        repo.getShiftCounters('S01', new Date('2026-08-31'), '1'),
      ).resolves.toEqual({
        invoiceCashCount: 2,
        invoiceCreditCount: 3,
        creditNoteCount: 1,
        outflowCount: 0,
      });
      expect(prisma.boShift.findFirst).toHaveBeenCalledWith({
        where: { storeCode: 'S01', shiftDate: new Date('2026-08-31'), shiftNo: '1' },
        select: {
          invoiceCashCount: true,
          invoiceCreditCount: true,
          creditNoteCount: true,
          outflowCount: true,
        },
      });
    });

    it('should default counters to zero when no shift is found', async () => {
      prisma.boShift.findFirst.mockResolvedValue(null);
      await expect(
        repo.getShiftCounters('S01', new Date('2026-08-31'), '1'),
      ).resolves.toEqual({
        invoiceCashCount: 0,
        invoiceCreditCount: 0,
        creditNoteCount: 0,
        outflowCount: 0,
      });
    });
  });

  describe('getUniqueDates', () => {
    it('should return the distinct shift dates', async () => {
      const dates = [new Date('2026-08-31'), new Date('2026-08-30')];
      prisma.boShift.findMany.mockResolvedValue([
        { shiftDate: dates[0] },
        { shiftDate: dates[1] },
      ]);

      await expect(repo.getUniqueDates('S01')).resolves.toEqual(dates);
      expect(prisma.boShift.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
        select: { shiftDate: true },
        distinct: ['shiftDate'],
        orderBy: { shiftDate: 'desc' },
      });
    });
  });

  describe('queryRawUnsafe', () => {
    it('should run a raw query with params', async () => {
      await expect(repo.queryRawUnsafe('SELECT * FROM t WHERE id = ?', [1])).resolves.toEqual(
        [{ id: 1 }],
      );
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM t WHERE id = ?',
        1,
      );
    });

    it('should run a raw query without params', async () => {
      await expect(repo.queryRawUnsafe('SELECT 1')).resolves.toEqual([{ id: 1 }]);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    });
  });
});