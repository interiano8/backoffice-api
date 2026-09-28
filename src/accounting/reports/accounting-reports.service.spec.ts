import { Test, TestingModule } from '@nestjs/testing';
import { AccountingReportsService } from './accounting-reports.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AccountingReportsService', () => {
  let service: AccountingReportsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      journalEntry: {
        findMany: jest.fn(),
      },
      account: {
        findMany: jest.fn(),
      },
      journalEntryLine: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AccountingReportsService>(AccountingReportsService);
  });

  it('debe generar el Libro Diario con totales de débitos y créditos', async () => {
    prisma.journalEntry.findMany.mockResolvedValue([
      { id: 'e1', entryNumber: 1, totalDebit: 1500, totalCredit: 1500, lines: [] },
      { id: 'e2', entryNumber: 2, totalDebit: 2500, totalCredit: 2500, lines: [] },
    ]);

    const res = await service.getJournalBook({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });

    expect(res.entriesCount).toBe(2);
    expect(res.totalDebits).toBe(4000);
    expect(res.totalCredits).toBe(4000);
  });

  it('debe calcular el Estado de Resultados (P&L)', async () => {
    prisma.account.findMany.mockResolvedValue([
      { id: 'acc-rev', code: '4.1.01.01', name: 'Ventas Superior', type: 'REVENUE', nature: 'CREDIT' },
      { id: 'acc-cost', code: '5.1.01.01', name: 'Costo Superior', type: 'COST', nature: 'DEBIT' },
      { id: 'acc-exp', code: '6.1.01.01', name: 'Sueldos', type: 'EXPENSE', nature: 'DEBIT' },
    ]);

    prisma.journalEntryLine.findMany
      .mockResolvedValueOnce([{ debit: 0, credit: 100000 }]) // Ventas: 100k
      .mockResolvedValueOnce([{ debit: 75000, credit: 0 }])  // Costo: 75k
      .mockResolvedValueOnce([{ debit: 10000, credit: 0 }]); // Gasto: 10k

    const res = await service.getIncomeStatement({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });

    expect(res.revenues.total).toBe(100000);
    expect(res.costs.total).toBe(75000);
    expect(res.grossProfit).toBe(25000); // 100k - 75k
    expect(res.expenses.total).toBe(10000);
    expect(res.netOperatingProfit).toBe(15000); // 25k - 10k
  });
});
