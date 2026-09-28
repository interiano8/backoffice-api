import { Test, TestingModule } from '@nestjs/testing';
import { ShiftAccountingGenerator } from './shift-accounting.generator';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountingMappingService } from '../mapping/accounting-mapping.service';
import { JournalEntriesService } from '../entries/journal-entries.service';
import { CostCentersService } from '../cost-centers/cost-centers.service';

describe('ShiftAccountingGenerator', () => {
  let generator: ShiftAccountingGenerator;
  let prisma: any;
  let mappingService: any;
  let journalEntriesService: any;
  let costCentersService: any;

  beforeEach(async () => {
    prisma = {
      boShift: { findUnique: jest.fn() },
      boStore: { findUnique: jest.fn().mockResolvedValue({ moduleAccounting: 1 }) },
      boSaleHeader: { findMany: jest.fn() },
      journalEntry: { findFirst: jest.fn() },
    };

    mappingService = {
      resolveAccountId: jest.fn().mockImplementation((cat, id) => `acc-${cat}-${id}`),
    };

    journalEntriesService = {
      createEntry: jest.fn().mockResolvedValue({ id: 'entry-created', status: 'DRAFT' }),
      updateEntry: jest.fn().mockResolvedValue({ id: 'entry-updated', status: 'DRAFT' }),
    };

    costCentersService = {
      getCostCenterByCode: jest.fn().mockResolvedValue({ id: 'cc-001', code: '001' }),
      createCostCenter: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftAccountingGenerator,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountingMappingService, useValue: mappingService },
        { provide: JournalEntriesService, useValue: journalEntriesService },
        { provide: CostCentersService, useValue: costCentersService },
      ],
    }).compile();

    generator = module.get<ShiftAccountingGenerator>(ShiftAccountingGenerator);
  });

  it('debe generar una póliza en DRAFT para un turno cuadrado', async () => {
    prisma.boShift.findUnique.mockResolvedValue({
      id: 'shift-1',
      storeCode: '001',
      shiftDate: new Date('2026-09-28'),
      shiftNo: '1',
      employeeName: 'Juan Cajero',
      cashDeclared: 5000,
      cardDeclared: 3000,
      cashVariance: 0,
      totalSale: 8000,
    });

    prisma.boSaleHeader.findMany.mockResolvedValue([
      {
        totalAmount: 8000,
        payments: [
          { chargeMethodCode: 'CASH', amount: 5000 },
          { chargeMethodCode: 'CARD', amount: 3000 },
        ],
        lines: [
          { productName: 'GASOLINA SUPERIOR', amount: 5000 },
          { productName: 'DIESEL 50PPM', amount: 3000 },
        ],
      },
    ]);

    prisma.journalEntry.findFirst.mockResolvedValue(null);

    const res = await generator.generateEntryForShift('shift-1', 'user1');
    expect(res?.id).toBe('entry-created');
    expect(journalEntriesService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DIARY',
        sourceRef: 'shift:shift-1',
        lines: expect.arrayContaining([
          expect.objectContaining({ debit: 5000, credit: 0 }),
          expect.objectContaining({ debit: 3000, credit: 0 }),
          expect.objectContaining({ debit: 0, credit: 5000 }),
          expect.objectContaining({ debit: 0, credit: 3000 }),
        ]),
      }),
      'user1',
    );
  });

  it('debe registrar línea de faltante cuando cashVariance < 0', async () => {
    prisma.boShift.findUnique.mockResolvedValue({
      id: 'shift-short',
      storeCode: '001',
      shiftDate: new Date('2026-09-28'),
      shiftNo: '2',
      employeeName: 'Pedro Bombero',
      cashDeclared: 950,
      cashVariance: -50, // Faltante
      totalSale: 1000,
    });

    prisma.boStore.findUnique.mockResolvedValue({
      moduleAccounting: 1,
    });

    prisma.boSaleHeader.findMany.mockResolvedValue([
      {
        totalAmount: 1000,
        payments: [{ chargeMethodCode: 'CASH', amount: 950 }],
        lines: [{ productName: 'GASOLINA REGULAR', amount: 1000 }],
      },
    ]);

    prisma.journalEntry.findFirst.mockResolvedValue(null);

    await generator.generateEntryForShift('shift-short', 'user1');

    expect(journalEntriesService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ debit: 950, credit: 0 }), // caja
          expect.objectContaining({ debit: 50, credit: 0 }),  // faltante empleado
          expect.objectContaining({ debit: 0, credit: 1000 }), // venta regular
        ]),
      }),
      'user1',
    );
  });

  it('debe omitir la generación si la estación tiene el módulo de contabilidad deshabilitado', async () => {
    prisma.boShift.findUnique.mockResolvedValue({
      id: 'shift-disabled',
      storeCode: '002',
    });

    prisma.boStore.findUnique.mockResolvedValue({
      moduleAccounting: 0,
    });

    const res = await generator.generateEntryForShift('shift-disabled', 'user1');
    expect(res).toBeNull();
    expect(journalEntriesService.createEntry).not.toHaveBeenCalled();
  });
});
