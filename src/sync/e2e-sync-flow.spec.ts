import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { FiscalAuditService } from '../reconciliation/application/services/fiscal-audit.service';

describe('E2E Complete Flow: POS Sale -> Shift Close -> Control Totals -> Auto Reconciliation -> Fiscal SAR Audit', () => {
  let syncService: SyncService;
  let fiscalAuditService: FiscalAuditService;

  // In-memory mock database state
  const db = {
    stores: new Map<string, any>(),
    shifts: new Map<string, any>(),
    salesHeaders: new Map<string, any>(),
    saleLines: new Map<string, any>(),
    payments: new Map<string, any>(),
  };

  const prismaMock: any = {
    $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prismaMock)),

    boStore: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const key = where.code;
        const record = { ...(db.stores.get(key) || create), ...update, code: key };
        db.stores.set(key, record);
        return record;
      }),
      findUnique: jest.fn(async ({ where }) => db.stores.get(where.code) || null),
    },

    boShift: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const comp = where.source_storeCode_shiftDate_shiftNo_employeeName;
        const key = `${comp.storeCode}_${comp.shiftDate.toISOString().split('T')[0]}_${comp.shiftNo}_${comp.employeeName}`;
        const existing = db.shifts.get(key);
        const record = { id: existing?.id || `shift-${Date.now()}`, ...(existing || create), ...update };
        db.shifts.set(key, record);
        return record;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const comp = where.source_storeCode_shiftDate_shiftNo_employeeName;
        const key = `${comp.storeCode}_${comp.shiftDate.toISOString().split('T')[0]}_${comp.shiftNo}_${comp.employeeName}`;
        return db.shifts.get(key) || null;
      }),
      update: jest.fn(async ({ where, data }) => {
        for (const [k, v] of db.shifts.entries()) {
          if (v.id === where.id) {
            const updated = { ...v, ...data };
            db.shifts.set(k, updated);
            return updated;
          }
        }
        return null;
      }),
    },

    boSaleHeader: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const comp = where.source_storeCode_transactionId;
        const key = `${comp.storeCode}_${comp.transactionId}`;
        const existing = db.salesHeaders.get(key);
        const record = { id: existing?.id || `header-${Date.now()}`, ...(existing || create), ...update };
        db.salesHeaders.set(key, record);
        return record;
      }),
      findMany: jest.fn(async ({ where }) => {
        const results: any[] = [];
        for (const h of db.salesHeaders.values()) {
          if (where.storeCode && h.storeCode !== where.storeCode) continue;
          if (where.shiftNo && h.shiftNo !== where.shiftNo) continue;
          if (where.employeeName && h.employeeName !== where.employeeName) continue;
          results.push(h);
        }
        return results;
      }),
    },

    boSale: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const comp = where.source_storeCode_externalId_lineNo;
        const key = `${comp.storeCode}_${comp.externalId}_${comp.lineNo}`;
        const record = { id: `line-${Date.now()}`, ...create, ...update };
        db.saleLines.set(key, record);
        return record;
      }),
    },

    boPaymentMethod: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const comp = where.source_storeCode_transactionId_chargeLineNo;
        const key = `${comp.storeCode}_${comp.transactionId}_${comp.chargeLineNo}`;
        const record = { id: `pay-${Date.now()}`, ...create, ...update };
        db.payments.set(key, record);
        return record;
      }),
    },

    boHose: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    db.stores.clear();
    db.shifts.clear();
    db.salesHeaders.clear();
    db.saleLines.clear();
    db.payments.clear();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        FiscalAuditService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    syncService = module.get<SyncService>(SyncService);
    fiscalAuditService = module.get<FiscalAuditService>(FiscalAuditService);
  });

  it('ejecuta el ciclo de vida completo: apertura -> ventas parciales -> cierre en progreso -> sincronización total -> auto-cuadre y auditoría SAR limpia', async () => {
    const storeCode = '001';
    const shiftDate = '2026-09-25';
    const shiftNo = '1';
    const employeeName = 'Carlos Mendoza';

    // =========================================================================
    // PASO 1: Apertura de Turno Operacional en POS
    // =========================================================================
    const openShiftPayload = {
      storeCode,
      sentAt: '2026-09-25T08:00:00Z',
      shifts: [
        {
          shiftDate,
          shiftNo,
          employeeName,
          startTime: '2026-09-25T08:00:00Z',
          endTime: null,
          status: 'OPEN',
          totalSale: 0,
          totalDiscount: 0,
        },
      ],
    };

    const resOpen = await syncService.syncUp(openShiftPayload as any);
    expect(resOpen.success).toBe(true);

    const shiftKey = `${storeCode}_${shiftDate}_${shiftNo}_${employeeName}`;
    const initialShift = db.shifts.get(shiftKey);
    expect(initialShift).toBeDefined();
    expect(initialShift.auditStatus).toBe('OPEN_OPERATIONAL');
    expect(initialShift.isBalanced).toBe(false);

    // =========================================================================
    // PASO 2: Se registra la primera venta (Venta 1 de 2)
    // Factura: 001-001-01-00000001 (L. 100 de Combustible Súper)
    // =========================================================================
    const sale1Payload = {
      storeCode,
      sentAt: '2026-09-25T09:30:00Z',
      sales: [
        {
          transactionId: 'TX-POS-1001',
          docType: 1,
          docNo: '001-001-01-00000001',
          shiftDate,
          shiftNo,
          employeeName,
          subTotal: 86.96,
          totalAmount: 100.0,
          lines: [
            {
              lineNo: 1,
              externalId: 'EXT-1001-1',
              timestamp: '2026-09-25T09:30:00Z',
              amount: 100.0,
              unitPrice: 32.5,
              volume: 3.076,
              productName: 'SUPER',
            },
          ],
          payments: [
            {
              chargeLineNo: 1,
              chargeMethodCode: '1002',
              description: 'EFECTIVO',
              amount: 100.0,
            },
          ],
        },
      ],
    };

    const resSale1 = await syncService.syncUp(sale1Payload as any);
    expect(resSale1.success).toBe(true);
    expect(db.salesHeaders.size).toBe(1);

    // =========================================================================
    // PASO 3: Cierre de Turno en POS con Control Totals
    // El POS emitió 2 ventas por un total de L. 250, pero solo 1 ha llegado a Backoffice
    // =========================================================================
    const closeShiftPayload = {
      storeCode,
      sentAt: '2026-09-25T16:00:00Z',
      shifts: [
        {
          shiftDate,
          shiftNo,
          employeeName,
          startTime: '2026-09-25T08:00:00Z',
          endTime: '2026-09-25T16:00:00Z',
          status: 'CLOSED',
          totalSale: 250.0,
          totalDiscount: 0,
          cashDeclared: 250.0, // El cajero declaró exactamente L. 250
          controlTotals: {
            totalSalesCount: 2,
            totalSalesAmount: 250.0,
          },
        },
      ],
    };

    const resClose = await syncService.syncUp(closeShiftPayload as any);
    expect(resClose.success).toBe(true);

    const shiftAfterClose = db.shifts.get(shiftKey);
    // Debe entrar en estado SYNC_IN_PROGRESS porque falta 1 venta por sincronizar
    expect(shiftAfterClose.auditStatus).toBe('SYNC_IN_PROGRESS');
    expect(shiftAfterClose.isBalanced).toBe(false);
    expect(shiftAfterClose.cashVariance).toBeNull();

    const inProgressDetails = JSON.parse(shiftAfterClose.presentationDetails);
    expect(inProgressDetails.expectedCount).toBe(2);
    expect(inProgressDetails.actualCount).toBe(1);
    expect(inProgressDetails.actualAmount).toBe(100.0);

    // =========================================================================
    // PASO 4: Llegada de la segunda venta (Venta 2 de 2)
    // Factura: 001-001-01-00000002 (L. 150 de Diésel)
    // El trigger reactivo reevaluateShiftOnSale debe auto-cuadrar el turno
    // =========================================================================
    const sale2Payload = {
      storeCode,
      sentAt: '2026-09-25T16:05:00Z',
      sales: [
        {
          transactionId: 'TX-POS-1002',
          docType: 1,
          docNo: '001-001-01-00000002',
          shiftDate,
          shiftNo,
          employeeName,
          subTotal: 130.43,
          totalAmount: 150.0,
          lines: [
            {
              lineNo: 1,
              externalId: 'EXT-1002-1',
              timestamp: '2026-09-25T15:45:00Z',
              amount: 150.0,
              unitPrice: 28.0,
              volume: 5.357,
              productName: 'DIESEL',
            },
          ],
          payments: [
            {
              chargeLineNo: 1,
              chargeMethodCode: '1002',
              description: 'EFECTIVO',
              amount: 150.0,
            },
          ],
        },
      ],
    };

    const resSale2 = await syncService.syncUp(sale2Payload as any);
    expect(resSale2.success).toBe(true);
    expect(db.salesHeaders.size).toBe(2);

    // Verificar que el turno ahora está en BALANCED
    const shiftFinal = db.shifts.get(shiftKey);
    expect(shiftFinal.auditStatus).toBe('BALANCED');
    expect(shiftFinal.isBalanced).toBe(true);
    expect(shiftFinal.cashVariance).toBe(0);

    const finalDetails = JSON.parse(shiftFinal.presentationDetails);
    expect(finalDetails.expectedCount).toBe(2);
    expect(finalDetails.actualCount).toBe(2);
    expect(finalDetails.actualAmount).toBe(250.0);
    expect(finalDetails.reconciledAt).toBeDefined();

    // =========================================================================
    // PASO 5: Auditoría Fiscal SAR (Verificación de Correlativos)
    // =========================================================================
    const fiscalReport = await fiscalAuditService.detectFiscalGaps(storeCode);
    expect(fiscalReport.totalInvoicesScanned).toBe(2);
    expect(fiscalReport.totalGapsDetected).toBe(0);
    expect(fiscalReport.totalMissingInvoices).toBe(0);
    expect(fiscalReport.hasGaps).toBe(false);
    expect(fiscalReport.gaps).toHaveLength(0);
  });

  it('detecta descuadre en caja (DISCREPANCY) y salto de correlativos SAR cuando hay anomalías', async () => {
    const storeCode = '001';
    const shiftDate = '2026-09-25';
    const shiftNo = '2';
    const employeeName = 'María López';

    // Venta con salto de numeración: pasa de 00000010 a 00000013 (faltan 11 y 12)
    const salesPayload = {
      storeCode,
      sentAt: '2026-09-25T18:00:00Z',
      sales: [
        {
          transactionId: 'TX-10',
          docType: 1,
          docNo: '001-001-01-00000010',
          shiftDate,
          shiftNo,
          employeeName,
          subTotal: 100,
          totalAmount: 100,
          lines: [{ lineNo: 1, externalId: 'E10', timestamp: '2026-09-25T17:00:00Z', amount: 100 }],
          payments: [{ chargeLineNo: 1, chargeMethodCode: '1002', description: 'EFECTIVO', amount: 100 }],
        },
        {
          transactionId: 'TX-13',
          docType: 1,
          docNo: '001-001-01-00000013',
          shiftDate,
          shiftNo,
          employeeName,
          subTotal: 100,
          totalAmount: 100,
          lines: [{ lineNo: 1, externalId: 'E13', timestamp: '2026-09-25T17:30:00Z', amount: 100 }],
          payments: [{ chargeLineNo: 1, chargeMethodCode: '1002', description: 'EFECTIVO', amount: 100 }],
        },
      ],
      shifts: [
        {
          shiftDate,
          shiftNo,
          employeeName,
          startTime: '2026-09-25T16:00:00Z',
          endTime: '2026-09-25T23:59:59Z',
          status: 'CLOSED',
          totalSale: 200,
          totalDiscount: 0,
          cashDeclared: 170, // Faltante de L. 30 (declaró 170 vs 200)
          controlTotals: {
            totalSalesCount: 2,
            totalSalesAmount: 200,
          },
        },
      ],
    };

    await syncService.syncUp(salesPayload as any);

    const shiftKey = `${storeCode}_${shiftDate}_${shiftNo}_${employeeName}`;
    const shift = db.shifts.get(shiftKey);

    // Debe registrar DISCREPANCY con cashVariance = -30
    expect(shift.auditStatus).toBe('DISCREPANCY');
    expect(shift.isBalanced).toBe(false);
    expect(shift.cashVariance).toBe(-30);

    // Auditoría SAR debe detectar el salto de facturas 11 y 12
    const fiscalReport = await fiscalAuditService.detectFiscalGaps(storeCode);
    expect(fiscalReport.hasGaps).toBe(true);
    expect(fiscalReport.totalGapsDetected).toBe(1);
    expect(fiscalReport.totalMissingInvoices).toBe(2);
    expect(fiscalReport.gaps[0].missingFrom).toBe('001-001-01-00000011');
    expect(fiscalReport.gaps[0].missingTo).toBe('001-001-01-00000012');
    expect(fiscalReport.gaps[0].missingDocNos).toEqual([
      '001-001-01-00000011',
      '001-001-01-00000012',
    ]);
  });
});
