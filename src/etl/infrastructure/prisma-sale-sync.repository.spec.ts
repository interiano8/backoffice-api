import { Logger } from '@nestjs/common';
import { PrismaSaleSyncRepository } from './prisma-sale-sync.repository';
import type { DbExecutor } from '../../common/connections/db-executor.interface';

describe('PrismaSaleSyncRepository', () => {
  let repo: PrismaSaleSyncRepository;
  let prisma: {
    boSaleHeader: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      createMany: jest.Mock;
      updateMany: jest.Mock;
    };
    boSale: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
  };
  let pool: DbExecutor & { queryParams: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    prisma = {
      boSaleHeader: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      boSale: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    pool = {
      queryParams: jest.fn().mockResolvedValue({ recordset: [], rowsAffected: [0] }),
      query: jest.fn(),
      execute: jest.fn(),
      close: jest.fn(),
    };
    repo = new PrismaSaleSyncRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('syncSaleHeaders', () => {
    const headerRow = {
      TransactionId: 'T1',
      DocType: '1',
      DocNo: 'D1',
      AppliedDocNo: 'A1',
      ShiftDate: '2026-08-31',
      ShiftNo: '2',
      AttendantName: 'Juan',
      CustomerName: 'Cliente',
      CustomerId: 'C1',
      RTN: '0801',
      SubTotal: '100',
      TotalAmount: '120',
      KM: '10',
      Orden: '1',
      Placa: 'P',
      Chofer: 'Ch',
      ReconcilerShiftId: 'RS1',
    };

    it('should map, dedupe, create and update sale headers', async () => {
      pool.queryParams.mockResolvedValue({
        recordset: [
          headerRow,
          {
            TransactionId: 'T2',
            DocType: null,
            DocNo: null,
            AppliedDocNo: null,
            ShiftDate: null,
            ShiftNo: null,
            AttendantName: null,
            CustomerName: null,
            CustomerId: null,
            RTN: null,
            SubTotal: 'abc',
            TotalAmount: null,
            KM: null,
            Orden: null,
            Placa: null,
            Chofer: null,
            ReconcilerShiftId: null,
          },
          { ...headerRow, TransactionId: 'T1', ShiftNo: '99', AppliedDocNo: 'A2' },
        ],
        rowsAffected: [3],
      });
      prisma.boSaleHeader.findMany.mockResolvedValue([
        { transactionId: 'T2' },
      ]);

      await repo.syncSaleHeaders(pool, 'S01', undefined, 'RS1');

      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('WHERE v.id_transaccion_pos = @reconcilerShiftId'),
        { reconcilerShiftId: 'RS1' },
      );
      expect(prisma.boSaleHeader.findMany).toHaveBeenCalledWith({
        where: { source: 'TPV', storeCode: 'S01', transactionId: { in: ['T1', 'T2'] } },
        select: { transactionId: true },
      });

      expect(prisma.boSaleHeader.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            transactionId: 'T1',
            docType: 1,
            docNo: 'D1',
            shiftNo: '99',
            employeeName: 'Juan',
            customerNo: 'C1',
            customerName: 'Cliente',
            rtn: '0801',
            subTotal: 100,
            totalAmount: 120,
            km: '10',
            orden: '1',
            placa: 'P',
            chofer: 'Ch',
            reconcilerShiftId: 'RS1',
            appliedDocNo: 'A2',
          }),
        ],
      });
      expect(prisma.boSaleHeader.updateMany).toHaveBeenCalledWith({
        where: {
          source: 'TPV',
          storeCode: 'S01',
          transactionId: 'T2',
          appliedDocNo: null,
        },
        data: { appliedDocNo: null },
      });
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Bulk inserting 1 new sale headers...'),
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Synced 3 Sale Headers for store S01'),
      );
    });

    it('should return early when the recordset is empty', async () => {
      await repo.syncSaleHeaders(pool, 'S01');
      expect(prisma.boSaleHeader.findMany).not.toHaveBeenCalled();
      expect(prisma.boSaleHeader.createMany).not.toHaveBeenCalled();
      expect(prisma.boSaleHeader.updateMany).not.toHaveBeenCalled();
    });

    it('should query by specificDate', async () => {
      await repo.syncSaleHeaders(pool, 'S01', new Date('2026-08-31T10:00:00Z'));
      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('DATE(COALESCE(t.inicio_turno, v.fecha_hora_venta)) = DATE(@specificDate)'),
        { specificDate: '2026-08-31' },
      );
    });

    it('should start from the last header minus six hours', async () => {
      const lastDate = new Date('2026-01-05T00:00:00Z');
      prisma.boSaleHeader.findFirst.mockResolvedValue({ shiftDate: lastDate });

      await repo.syncSaleHeaders(pool, 'S01');

      const expectedStart = new Date(lastDate.getTime() - 6 * 60 * 60 * 1000).toISOString();
      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(t.inicio_turno, v.fecha_hora_venta) >= @startDate'),
        { startDate: expectedStart },
      );
    });

    it('should fall back to the default lookback window', async () => {
      await repo.syncSaleHeaders(pool, 'S01');
      const args = pool.queryParams.mock.calls[0];
      const startDate = (args[1] as { startDate: string }).startDate;
      const elapsedMs = Date.now() - new Date(startDate).getTime();
      expect(elapsedMs).toBeGreaterThan(89 * 24 * 60 * 60 * 1000);
      expect(elapsedMs).toBeLessThan(91 * 24 * 60 * 60 * 1000);
    });
  });

  describe('syncTpvSales', () => {
    const configMaps = {
      hoseMap: { '1-1': { unit: 'LT', grade: 'REGULAR', tankId: 'T1' } },
      productMap: {
        REGULAR: { unit: 'LT', standardName: 'REGULAR' },
        DIESEL: { unit: 'GL', standardName: 'DIESEL' },
      },
    };

    const saleRow = {
      ExternalId: 'T1',
      LineNumber: '1',
      SaleIdFusion: 'SF1',
      Timestamp: '2026-08-31T05:00:00Z',
      ShiftDate: '2026-08-31',
      ShiftNo: '1',
      AttendantName: 'Juan',
      CustomerName: 'Cliente',
      CustomerId: 'C1',
      DocType: '2',
      Amount: '100',
      Volume: '3.78541',
      Price: '30',
      Discount: '5',
      DiscountPct: '10',
      PumpId: '1',
      HoseId: 'A',
      TankId: 'T1',
      fsAmount: '90',
      fsPPU: '28',
      fsVolume: '3',
      fsFinalVolume: '10',
      fsInitialVolume: '7',
      fsShiftId: 'FS1',
      POSSalesType: '1',
      AppliedDocNo: 'AD1',
      Description: 'REGULAR',
      ReconcilerShiftId: 'RS1',
    };

    it('should map rows using hose and product configuration', async () => {
      pool.queryParams.mockResolvedValue({
        recordset: [
          saleRow,
          {
            ...saleRow,
            ExternalId: 'T2',
            HoseId: 'B',
            Description: 'DIESEL',
            ReconcilerShiftId: null,
          },
          {
            ...saleRow,
            ExternalId: 'T3',
            PumpId: '5',
            HoseId: 'X',
            Description: null,
            fsAmount: null,
            fsPPU: null,
            fsVolume: null,
            fsFinalVolume: null,
            fsInitialVolume: null,
            fsShiftId: null,
          },
        ],
        rowsAffected: [3],
      });
      prisma.boSaleHeader.findMany.mockResolvedValue([
        { id: 'h1', transactionId: 'T1' },
        { id: 'h2', transactionId: 'T2' },
        { id: 'h3', transactionId: 'T3' },
      ]);

      await repo.syncTpvSales(pool, 'S01', configMaps, undefined, 'RS1');

      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('WHERE v.id_transaccion_pos = @reconcilerShiftId'),
        { reconcilerShiftId: 'RS1' },
      );

      const created = prisma.boSale.createMany.mock.calls[0][0].data;
      expect(created).toHaveLength(3);

      expect(created[0]).toEqual(
        expect.objectContaining({
          externalId: 'T1',
          lineNo: 1,
          saleIdFusion: 'SF1',
          shiftNo: '1',
          attendantName: 'Juan',
          customerName: 'Cliente',
          customerId: 'C1',
          docType: 2,
          amount: 100,
          volume: 3.78541,
          unitPrice: 30,
          discount: 5,
          discountPct: 10,
          unitOfMeasure: 'LT',
          productName: 'REGULAR',
          pumpId: '1',
          hoseId: 'A',
          tankId: 'T1',
          isReconciled: false,
          reconcilerShiftId: 'RS1',
          fsAmount: 90,
          fsPPU: 28,
          fsVolume: 3,
          fsFinalVolume: 10,
          fsInitialVolume: 7,
          fsShiftId: 'FS1',
          appliedDocNo: 'AD1',
          saleHeaderId: 'h1',
        }),
      );
      expect(created[1]).toEqual(
        expect.objectContaining({
          externalId: 'T2',
          unitOfMeasure: 'GL',
          productName: 'DIESEL',
          saleHeaderId: 'h2',
        }),
      );
      expect(created[2]).toEqual(
        expect.objectContaining({
          externalId: 'T3',
          unitOfMeasure: 'LT',
          productName: 'Sin Producto',
          fsAmount: null,
          fsPPU: null,
          fsVolume: null,
          fsFinalVolume: null,
          fsInitialVolume: null,
          fsShiftId: null,
          saleHeaderId: 'h3',
        }),
      );

      expect(prisma.boSale.deleteMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01', reconcilerShiftId: { in: ['RS1'] } },
      });
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Synced 3 sales lines for store S01'),
      );
    });

    it('should map all hose letters and numeric hose ids', async () => {
      const letters = ['A', 'B', 'C', 'D', '9'];
      pool.queryParams.mockResolvedValue({
        recordset: letters.map((letter, i) => ({
          ...saleRow,
          ExternalId: `L${i}`,
          HoseId: letter,
          Description: 'REGULAR',
        })),
        rowsAffected: [letters.length],
      });
      prisma.boSaleHeader.findMany.mockImplementation(
        async ({ where }: { where: { transactionId: { in: string[] } } }) =>
          where.transactionId.in.map((id) => ({ id: `h-${id}`, transactionId: id })),
      );

      await repo.syncTpvSales(pool, 'S01', configMaps, undefined, 'RS1');

      const created = prisma.boSale.createMany.mock.calls[0][0].data;
      expect(created.map((c: any) => c.hoseId)).toEqual(['A', 'B', 'C', 'D', '9']);
      expect(created[0]).toEqual(expect.objectContaining({ unitOfMeasure: 'LT' }));
    });

    it('should query by specificDate', async () => {
      await repo.syncTpvSales(pool, 'S01', configMaps, new Date('2026-08-31T10:00:00Z'));
      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('DATE(COALESCE(t.inicio_turno, v.fecha_hora_venta)) = DATE(@specificDate)'),
        { specificDate: '2026-08-31' },
      );
    });

    it('should start from the last sale minus one hour', async () => {
      const lastDate = new Date('2026-01-05T00:00:00Z');
      prisma.boSale.findFirst.mockResolvedValue({ timestamp: lastDate });

      await repo.syncTpvSales(pool, 'S01');

      expect(prisma.boSale.findFirst).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });
      const expectedStart = new Date(lastDate.getTime() - 60 * 60 * 1000).toISOString();
      expect(pool.queryParams).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(t.inicio_turno, v.fecha_hora_venta) >= @startDate'),
        { startDate: expectedStart },
      );
    });

    it('should skip persistence when no sale headers match', async () => {
      pool.queryParams.mockResolvedValue({
        recordset: [saleRow],
        rowsAffected: [1],
      });

      await repo.syncTpvSales(pool, 'S01', configMaps, undefined, 'RS1');

      expect(prisma.boSale.deleteMany).not.toHaveBeenCalled();
      expect(prisma.boSale.createMany).not.toHaveBeenCalled();
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Synced 0 sales lines for store S01'),
      );
    });

    it('should process records in chunks larger than the chunk size', async () => {
      const count = 1001;
      const recordset = Array.from({ length: count }, (_, i) => ({
        ...saleRow,
        ExternalId: `T${i}`,
        HoseId: 'A',
        ReconcilerShiftId: `R${i}`,
      }));
      pool.queryParams.mockResolvedValue({ recordset, rowsAffected: [count] });
      prisma.boSaleHeader.findMany.mockImplementation(
        async ({ where }: { where: { transactionId: { in: string[] } } }) =>
          where.transactionId.in.map((id) => ({ id: `h-${id}`, transactionId: id })),
      );

      await repo.syncTpvSales(pool, 'S01', configMaps, undefined, 'R0');

      expect(prisma.boSaleHeader.findMany).toHaveBeenCalledTimes(4);
      expect(prisma.boSale.deleteMany).toHaveBeenCalledTimes(2);
      expect(prisma.boSale.createMany).toHaveBeenCalledTimes(2);
      const firstChunk = prisma.boSale.createMany.mock.calls[0][0].data;
      const secondChunk = prisma.boSale.createMany.mock.calls[1][0].data;
      expect(firstChunk).toHaveLength(1000);
      expect(secondChunk).toHaveLength(1);
    });
  });
});