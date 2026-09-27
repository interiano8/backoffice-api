import { Logger } from '@nestjs/common';
import { PrismaPaymentSyncRepository } from './prisma-payment-sync.repository';
import type { DbExecutor } from '../../common/connections/db-executor.interface';

describe('PrismaPaymentSyncRepository', () => {
  let repo: PrismaPaymentSyncRepository;
  let prisma: {
    boPaymentMethod: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    boSaleHeader: { findMany: jest.Mock };
  };
  let pool: DbExecutor & { query: jest.Mock; queryParams: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma = {
      boPaymentMethod: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      boSaleHeader: { findMany: jest.fn().mockResolvedValue([]) },
    };
    pool = {
      query: jest.fn(),
      queryParams: jest.fn().mockResolvedValue({ recordset: [], rowsAffected: [0] }),
      execute: jest.fn(),
      close: jest.fn(),
    };
    repo = new PrismaPaymentSyncRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  const row1 = {
    TransactionId: 'T1',
    ChargeLineNo: '2',
    ShiftDate: '2026-01-02T05:00:00Z',
    ShiftNo: '3',
    EmployeeName: 'Juan',
    ChargeMethodCode: 'CR',
    Description: 'Credito',
    AmountVal: '100.5',
    PaymentCardNo: '1234',
    AdditionalData: '{}',
    EsTicket: true,
    ReconcilerShiftId: 'TX-1',
  };

  const row2 = {
    TransactionId: 'T2',
    ChargeLineNo: null,
    ShiftDate: '2026-01-02T06:00:00Z',
    ShiftNo: null,
    EmployeeName: null,
    ChargeMethodCode: null,
    Description: null,
    AmountVal: 'abc',
    PaymentCardNo: null,
    AdditionalData: null,
    EsTicket: 0,
    ReconcilerShiftId: null,
  };

  const row3 = {
    TransactionId: null,
    ChargeLineNo: null,
    ShiftDate: null,
    ShiftNo: null,
    EmployeeName: null,
    ChargeMethodCode: null,
    Description: null,
    AmountVal: null,
    PaymentCardNo: null,
    AdditionalData: null,
    EsTicket: null,
    ReconcilerShiftId: null,
  };

  describe('syncPaymentMethods with reconcilerShiftId', () => {
    it('should filter by reconcilerShiftId and sync payment methods', async () => {
      pool.queryParams.mockResolvedValue({
        recordset: [row1, row2, row3],
        rowsAffected: [3],
      });
      prisma.boSaleHeader.findMany.mockResolvedValue([
        { transactionId: 'T1' },
        { transactionId: 'T2' },
      ]);

      await repo.syncPaymentMethods(pool, 'S01', undefined, 'TX-1');

      expect(prisma.boPaymentMethod.findFirst).not.toHaveBeenCalled();
      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('WHERE pv.id_transaccion_pos = @reconcilerShiftId'),
        { reconcilerShiftId: 'TX-1' },
      );
      expect(prisma.boSaleHeader.findMany).toHaveBeenCalledWith({
        where: {
          source: 'TPV',
          storeCode: 'S01',
          transactionId: { in: ['T1', 'T2'] },
        },
        select: { transactionId: true },
      });
      expect(prisma.boPaymentMethod.deleteMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01', reconcilerShiftId: { in: ['TX-1'] } },
      });
      expect(prisma.boPaymentMethod.createMany).toHaveBeenCalledWith({
        data: [
          {
            source: 'TPV',
            storeCode: 'S01',
            transactionId: 'T1',
            chargeLineNo: 2,
            shiftDate: new Date(Date.UTC(2026, 0, 2)),
            shiftNo: '3',
            employeeName: 'Juan',
            chargeMethodCode: 'CR',
            description: 'Credito',
            amount: 100.5,
            paymentCardNo: '1234',
            additionalData: '{}',
            esTicket: true,
            reconcilerShiftId: 'TX-1',
          },
          {
            source: 'TPV',
            storeCode: 'S01',
            transactionId: 'T2',
            chargeLineNo: 0,
            shiftDate: new Date(Date.UTC(2026, 0, 2)),
            shiftNo: '1',
            employeeName: 'Desconocido',
            chargeMethodCode: 'EFECTIVO',
            description: 'Sin Descripcion',
            amount: 0,
            paymentCardNo: null,
            additionalData: null,
            esTicket: false,
            reconcilerShiftId: null,
          },
        ],
      });
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Synced 3 payment method records for store S01'),
      );
    });
  });

  describe('syncPaymentMethods with specificDate', () => {
    it('should build a date based where clause', async () => {
      const specificDate = new Date('2026-03-10T12:00:00Z');
      pool.queryParams.mockResolvedValue({
        recordset: [row1],
        rowsAffected: [1],
      });
      prisma.boSaleHeader.findMany.mockResolvedValue([
        { transactionId: 'T1' },
      ]);

      await repo.syncPaymentMethods(pool, 'S01', specificDate);

      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('DATE(COALESCE(t.inicio_turno, v.fecha_hora_venta)) = DATE(@specificDate)'),
        { specificDate: '2026-03-10' },
      );
      expect(prisma.boPaymentMethod.createMany).toHaveBeenCalled();
    });
  });

  describe('syncPaymentMethods with default lookback', () => {
    it('should start from the last payment minus one hour', async () => {
      const lastShiftDate = new Date('2026-01-05T00:00:00Z');
      prisma.boPaymentMethod.findFirst.mockResolvedValue({
        shiftDate: lastShiftDate,
      });
      pool.queryParams.mockResolvedValue({
        recordset: [row1],
        rowsAffected: [1],
      });
      prisma.boSaleHeader.findMany.mockResolvedValue([
        { transactionId: 'T1' },
      ]);

      await repo.syncPaymentMethods(pool, 'S01');

      const expectedStart = new Date(
        lastShiftDate.getTime() - 60 * 60 * 1000,
      ).toISOString();
      expect(prisma.boPaymentMethod.findFirst).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
        orderBy: { shiftDate: 'desc' },
        select: { shiftDate: true },
      });
      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(t.inicio_turno, v.fecha_hora_venta) >= @startDate'),
        { startDate: expectedStart },
      );
    });

    it('should fall back to the default lookback window', async () => {
      pool.queryParams.mockResolvedValue({
        recordset: [row1],
        rowsAffected: [1],
      });
      prisma.boSaleHeader.findMany.mockResolvedValue([
        { transactionId: 'T1' },
      ]);

      await repo.syncPaymentMethods(pool, 'S01');

      const args = pool.queryParams.mock.calls[0];
      const startDate = (args[1] as { startDate: string }).startDate;
      const elapsedMs = Date.now() - new Date(startDate).getTime();
      expect(elapsedMs).toBeGreaterThan(89 * 24 * 60 * 60 * 1000);
      expect(elapsedMs).toBeLessThan(91 * 24 * 60 * 60 * 1000);
    });
  });

  describe('syncPaymentMethods edge cases', () => {
    it('should skip persistence when no sale headers match', async () => {
      pool.queryParams.mockResolvedValue({
        recordset: [row1],
        rowsAffected: [1],
      });
      prisma.boSaleHeader.findMany.mockResolvedValue([]);

      await repo.syncPaymentMethods(pool, 'S01', undefined, 'TX-1');

      expect(prisma.boPaymentMethod.deleteMany).not.toHaveBeenCalled();
      expect(prisma.boPaymentMethod.createMany).not.toHaveBeenCalled();
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Synced 1 payment method records for store S01'),
      );
    });

    it('should process records in chunks larger than the chunk size', async () => {
      const count = 1001;
      const recordset = Array.from({ length: count }, (_, i) => ({
        TransactionId: `T${i}`,
        ChargeLineNo: i,
        ShiftDate: '2026-01-02T05:00:00Z',
        ShiftNo: '1',
        EmployeeName: 'Emp',
        ChargeMethodCode: 'CR',
        Description: 'Credito',
        AmountVal: '10',
        PaymentCardNo: null,
        AdditionalData: null,
        EsTicket: true,
        ReconcilerShiftId: `R${i}`,
      }));
      pool.queryParams.mockResolvedValue({ recordset, rowsAffected: [count] });
      prisma.boSaleHeader.findMany.mockImplementation(
        async ({ where }: { where: { transactionId: { in: string[] } } }) =>
          where.transactionId.in.map((id) => ({ transactionId: id })),
      );

      await repo.syncPaymentMethods(pool, 'S01', undefined, 'R0');

      expect(prisma.boSaleHeader.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.boPaymentMethod.deleteMany).toHaveBeenCalledTimes(2);
      expect(prisma.boPaymentMethod.createMany).toHaveBeenCalledTimes(2);

      const firstChunk =
        prisma.boPaymentMethod.createMany.mock.calls[0][0].data;
      const secondChunk =
        prisma.boPaymentMethod.createMany.mock.calls[1][0].data;
      expect(firstChunk).toHaveLength(1000);
      expect(secondChunk).toHaveLength(1);
    });
  });
});
