import { Logger } from '@nestjs/common';
import { PrismaShiftSyncRepository } from './prisma-shift-sync.repository';
import type { DbExecutor } from '../../common/connections/db-executor.interface';

describe('PrismaShiftSyncRepository', () => {
  let repo: PrismaShiftSyncRepository;
  let prisma: {
    boShift: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      updateMany: jest.Mock;
    };
    boSale: { groupBy: jest.Mock };
  };
  let pool: DbExecutor & { queryParams: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    prisma = {
      boShift: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({ status: 'OPEN' }),
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      boSale: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    pool = {
      queryParams: jest.fn().mockResolvedValue({ recordset: [], rowsAffected: [0] }),
      query: jest.fn(),
      execute: jest.fn(),
      close: jest.fn(),
    };
    repo = new PrismaShiftSyncRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  const openRow = {
    'Shift Date': '2026-08-31',
    'Shift No_': '1',
    EmployeeName: 'Juan',
    StartTime: '2026-08-31T00:00:00Z',
    pos_codes: 'P1',
    reconciler_shifts: 'RS1',
    InvoiceCashCount: '1',
    InvoiceCreditCount: '2',
    CreditNoteCount: '3',
    OutflowCount: '4',
    fs_shift_ids: null,
  };

  describe('syncTpvShifts', () => {
    it('should upsert open and closed shifts', async () => {
      pool.queryParams.mockResolvedValue({
        recordset: [
          { ...openRow, OfficialEndTime: '2026-08-31T06:00:00Z' },
          { ...openRow, 'Shift No_': '2' },
          { ...openRow, 'Shift No_': null },
          { ...openRow, 'Shift No_': '3', OfficialEndTime: '2026-08-31T05:00:00Z' },
        ],
        rowsAffected: [4],
      });
      prisma.boShift.findUnique
        .mockResolvedValueOnce({ status: 'OPEN' })
        .mockResolvedValueOnce({ status: 'OPEN' })
        .mockResolvedValueOnce({ status: 'CLOSED' });

      await repo.syncTpvShifts(pool, 'S01');

      expect(prisma.boShift.findUnique).toHaveBeenCalledTimes(3);
      expect(prisma.boShift.upsert).toHaveBeenCalledTimes(2);

      const closedCall = prisma.boShift.upsert.mock.calls[0][0];
      expect(closedCall.update).toEqual(
        expect.objectContaining({
          status: 'CLOSED',
          endTime: new Date('2026-08-31T06:00:00Z'),
          startTime: new Date('2026-08-31T00:00:00Z'),
          invoiceCashCount: 1,
          invoiceCreditCount: 2,
          creditNoteCount: 3,
          outflowCount: 4,
          fsShiftIds: null,
        }),
      );
      expect(closedCall.where).toEqual({
        source_storeCode_shiftDate_shiftNo_employeeName: {
          source: 'TPV',
          storeCode: 'S01',
          shiftDate: expect.any(Date),
          shiftNo: '1',
          employeeName: 'Juan',
        },
      });

      const openCall = prisma.boShift.upsert.mock.calls[1][0];
      expect(openCall.update).toEqual(expect.objectContaining({ status: 'OPEN', endTime: null }));

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Synced 4 Shifts for store S01'),
      );
    });

    it('should query by reconcilerShiftId', async () => {
      await repo.syncTpvShifts(pool, 'S01', undefined, 'RS1');

      expect(prisma.boShift.findFirst).not.toHaveBeenCalled();
      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('t.id_transaccion_pos = @reconcilerShiftId'),
        { reconcilerShiftId: 'RS1' },
      );
    });

    it('should query by specificDate', async () => {
      await repo.syncTpvShifts(pool, 'S01', new Date('2026-08-31T10:00:00Z'));

      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('DATE(t.inicio_turno) = DATE(@specificDate)'),
        { specificDate: '2026-08-31' },
      );
    });

    it('should start from the last shift minus one hour', async () => {
      const lastShiftDate = new Date('2026-01-05T00:00:00Z');
      prisma.boShift.findFirst.mockResolvedValue({ shiftDate: lastShiftDate });

      await repo.syncTpvShifts(pool, 'S01');

      expect(prisma.boShift.findFirst).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
        orderBy: { shiftDate: 'desc' },
        select: { shiftDate: true },
      });
      const expectedStart = new Date(lastShiftDate.getTime() - 60 * 60 * 1000).toISOString();
      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('t.inicio_turno >= @startDate'),
        { startDate: expectedStart },
      );
    });

    it('should fall back to the default lookback window', async () => {
      await repo.syncTpvShifts(pool, 'S01');

      const args = pool.queryParams.mock.calls[0];
      const startDate = (args[1] as { startDate: string }).startDate;
      const elapsedMs = Date.now() - new Date(startDate).getTime();
      expect(elapsedMs).toBeGreaterThan(89 * 24 * 60 * 60 * 1000);
      expect(elapsedMs).toBeLessThan(91 * 24 * 60 * 60 * 1000);
    });
  });

  describe('updateShiftTotals', () => {
    const totals = [
      {
        shiftNo: '1',
        shiftDate: new Date('2026-08-31'),
        attendantName: 'Juan',
        _sum: { amount: 100, discount: 5 },
      },
      { shiftNo: null, shiftDate: null, attendantName: null, _sum: {} },
    ];

    it('should update totals for each valid grouped row', async () => {
      prisma.boSale.groupBy.mockResolvedValue(totals);

      await repo.updateShiftTotals('S01');

      expect(prisma.boSale.groupBy).toHaveBeenCalledWith({
        by: ['shiftNo', 'shiftDate', 'attendantName'],
        where: {
          storeCode: 'S01',
          shiftNo: { not: null },
          shiftDate: { not: null },
          attendantName: { not: null },
        },
        _sum: { amount: true, discount: true },
      });
      expect(prisma.boShift.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.boShift.updateMany).toHaveBeenCalledWith({
        where: {
          source: 'TPV',
          storeCode: 'S01',
          shiftNo: '1',
          shiftDate: new Date('2026-08-31'),
          employeeName: 'Juan',
        },
        data: { totalSale: 100, totalDiscount: 5 },
      });
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Updated totals for 2 shifts in store S01'),
      );
    });

    it('should filter by reconcilerShiftId when provided', async () => {
      await repo.updateShiftTotals('S01', undefined, 'RS1');
      expect(prisma.boSale.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ reconcilerShiftId: 'RS1' }),
        }),
      );
    });

    it('should filter by specificDate when provided', async () => {
      const date = new Date('2026-08-31');
      await repo.updateShiftTotals('S01', date);
      expect(prisma.boSale.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ shiftDate: date }),
        }),
      );
    });
  });
});