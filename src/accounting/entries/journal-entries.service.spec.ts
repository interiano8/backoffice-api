import { Test, TestingModule } from '@nestjs/testing';
import { JournalEntriesService } from './journal-entries.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalPeriodsService } from '../fiscal-periods/fiscal-periods.service';
import { BadRequestException } from '@nestjs/common';

describe('JournalEntriesService', () => {
  let service: JournalEntriesService;
  let prisma: any;
  let fiscalPeriodsService: any;

  beforeEach(async () => {
    prisma = {
      journalEntry: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      account: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    fiscalPeriodsService = {
      assertPeriodOpen: jest.fn().mockResolvedValue({ id: 'p-1', status: 'OPEN' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalEntriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: FiscalPeriodsService, useValue: fiscalPeriodsService },
      ],
    }).compile();

    service = module.get<JournalEntriesService>(JournalEntriesService);
  });

  it('debe rechazar una póliza descuadrada (Debe != Haber)', async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 'acc-1',
      code: '1.1.01.01',
      name: 'Caja',
      allowsMovement: true,
    });

    await expect(
      service.createEntry({
        date: '2026-09-28',
        concept: 'Venta descuadrada',
        lines: [
          { accountId: 'acc-1', debit: 1000, credit: 0 },
          { accountId: 'acc-1', debit: 0, credit: 950 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar cuentas de mayor que no permiten movimientos', async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 'acc-mayor',
      code: '1.1.01',
      name: 'Efectivo y Equivalentes',
      allowsMovement: false, // cuenta de mayor
    });

    await expect(
      service.createEntry({
        date: '2026-09-28',
        concept: 'Intento con cuenta de mayor',
        lines: [
          { accountId: 'acc-mayor', debit: 1000, credit: 0 },
          { accountId: 'acc-mayor', debit: 0, credit: 1000 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe crear exitosamente una póliza cuadrada en DRAFT', async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 'acc-1',
      code: '1.1.01.01',
      name: 'Caja',
      allowsMovement: true,
    });

    prisma.journalEntry.create.mockResolvedValue({
      id: 'entry-1',
      entryNumber: 1,
      concept: 'Venta cuadrada',
      status: 'DRAFT',
      totalDebit: 1000,
      totalCredit: 1000,
    });

    const res = await service.createEntry({
      date: '2026-09-28',
      concept: 'Venta cuadrada',
      lines: [
        { accountId: 'acc-1', debit: 1000, credit: 0 },
        { accountId: 'acc-1', debit: 0, credit: 1000 },
      ],
    });

    expect(res.id).toBe('entry-1');
    expect(res.status).toBe('DRAFT');
  });

  it('debe aprobar una póliza y pasarla a POSTED', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      status: 'DRAFT',
      date: new Date('2026-09-28'),
    });

    prisma.journalEntry.update.mockResolvedValue({
      id: 'entry-1',
      status: 'POSTED',
      approvedById: 'contador',
    });

    const res = await service.approveEntry('entry-1', 'contador');
    expect(res.status).toBe('POSTED');
  });

  it('debe anular una póliza POSTED creando la reversión en espejo', async () => {
    const originalEntry = {
      id: 'entry-posted',
      entryNumber: 42,
      status: 'POSTED',
      date: new Date('2026-09-28'),
      totalDebit: 5000,
      totalCredit: 5000,
      fiscalPeriodId: 'p-1',
      lines: [
        { accountId: 'acc-caja', costCenterId: 'cc-1', debit: 5000, credit: 0 },
        { accountId: 'acc-ventas', costCenterId: 'cc-1', debit: 0, credit: 5000 },
      ],
    };

    prisma.journalEntry.findUnique.mockResolvedValue(originalEntry);
    prisma.journalEntry.create.mockResolvedValue({ id: 'reversal-1', type: 'REVERSAL', status: 'POSTED' });
    prisma.journalEntry.update.mockResolvedValue({ ...originalEntry, status: 'VOIDED' });

    const result = await service.voidEntry('entry-posted', 'Error en factura', 'auditor');
    expect(result.original.status).toBe('VOIDED');
    expect(result.reversal.type).toBe('REVERSAL');
  });
});
