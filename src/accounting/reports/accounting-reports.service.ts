import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ReportDateFilter {
  startDate: string;
  endDate: string;
  costCenterId?: string;
}

@Injectable()
export class AccountingReportsService {
  private readonly logger = new Logger(AccountingReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Libro Diario General
   */
  async getJournalBook(filter: ReportDateFilter) {
    const where: any = {
      status: 'POSTED',
      date: {
        gte: new Date(filter.startDate),
        lte: new Date(filter.endDate),
      },
    };

    if (filter.costCenterId) {
      where.lines = {
        some: { costCenterId: filter.costCenterId },
      };
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      orderBy: [{ date: 'asc' }, { entryNumber: 'asc' }],
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, type: true } },
            costCenter: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    let totalDebits = 0;
    let totalCredits = 0;

    for (const e of entries) {
      totalDebits += Number(e.totalDebit);
      totalCredits += Number(e.totalCredit);
    }

    return {
      startDate: filter.startDate,
      endDate: filter.endDate,
      costCenterId: filter.costCenterId || null,
      entriesCount: entries.length,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      entries,
    };
  }

  /**
   * Libro Mayor y Auxiliares
   */
  async getGeneralLedger(filter: ReportDateFilter & { accountId?: string }) {
    const start = new Date(filter.startDate);
    const end = new Date(filter.endDate);

    const accountsWhere: any = {
      allowsMovement: true,
      isActive: true,
    };
    if (filter.accountId) {
      accountsWhere.id = filter.accountId;
    }

    const accounts = await this.prisma.account.findMany({
      where: accountsWhere,
      orderBy: { code: 'asc' },
    });

    const ledger: any[] = [];

    for (const acc of accounts) {
      // 1. Saldo Inicial anterior a startDate
      const priorLinesWhere: any = {
        accountId: acc.id,
        entry: {
          status: 'POSTED',
          date: { lt: start },
        },
      };
      if (filter.costCenterId) {
        priorLinesWhere.costCenterId = filter.costCenterId;
      }

      const priorLines = await this.prisma.journalEntryLine.findMany({
        where: priorLinesWhere,
        select: { debit: true, credit: true },
      });

      let initialBalance = 0;
      for (const pl of priorLines) {
        if (acc.nature === 'DEBIT') {
          initialBalance += Number(pl.debit) - Number(pl.credit);
        } else {
          initialBalance += Number(pl.credit) - Number(pl.debit);
        }
      }

      // 2. Movimientos del periodo
      const periodLinesWhere: any = {
        accountId: acc.id,
        entry: {
          status: 'POSTED',
          date: { gte: start, lte: end },
        },
      };
      if (filter.costCenterId) {
        periodLinesWhere.costCenterId = filter.costCenterId;
      }

      const periodLines = await this.prisma.journalEntryLine.findMany({
        where: periodLinesWhere,
        orderBy: { entry: { date: 'asc' } },
        include: {
          entry: { select: { entryNumber: true, date: true, concept: true, type: true } },
          costCenter: { select: { code: true, name: true } },
        },
      });

      if (initialBalance === 0 && periodLines.length === 0) {
        continue; // Omitir cuentas sin actividad ni saldo
      }

      let periodDebits = 0;
      let periodCredits = 0;
      let runningBalance = initialBalance;

      const movements = periodLines.map((l) => {
        const d = Number(l.debit);
        const c = Number(l.credit);
        periodDebits += d;
        periodCredits += c;

        if (acc.nature === 'DEBIT') {
          runningBalance += d - c;
        } else {
          runningBalance += c - d;
        }

        return {
          entryNumber: l.entry.entryNumber,
          date: l.entry.date,
          concept: l.description || l.entry.concept,
          costCenter: l.costCenter?.name || 'General',
          debit: d,
          credit: c,
          balance: Math.round(runningBalance * 100) / 100,
        };
      });

      ledger.push({
        account: {
          id: acc.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          nature: acc.nature,
        },
        initialBalance: Math.round(initialBalance * 100) / 100,
        totalDebits: Math.round(periodDebits * 100) / 100,
        totalCredits: Math.round(periodCredits * 100) / 100,
        endingBalance: Math.round(runningBalance * 100) / 100,
        movements,
      });
    }

    return {
      startDate: filter.startDate,
      endDate: filter.endDate,
      costCenterId: filter.costCenterId || null,
      accounts: ledger,
    };
  }

  /**
   * Balance de Comprobación (Sumas y Saldos)
   */
  async getTrialBalance(filter: ReportDateFilter) {
    const ledger = await this.getGeneralLedger(filter);

    let totalSumDebits = 0;
    let totalSumCredits = 0;
    let totalDebitBalances = 0;
    let totalCreditBalances = 0;

    const rows = ledger.accounts.map((item) => {
      totalSumDebits += item.totalDebits;
      totalSumCredits += item.totalCredits;

      let debitBalance = 0;
      let creditBalance = 0;

      if (item.account.nature === 'DEBIT') {
        if (item.endingBalance >= 0) {
          debitBalance = item.endingBalance;
        } else {
          creditBalance = Math.abs(item.endingBalance);
        }
      } else {
        if (item.endingBalance >= 0) {
          creditBalance = item.endingBalance;
        } else {
          debitBalance = Math.abs(item.endingBalance);
        }
      }

      totalDebitBalances += debitBalance;
      totalCreditBalances += creditBalance;

      return {
        code: item.account.code,
        name: item.account.name,
        type: item.account.type,
        nature: item.account.nature,
        initialBalance: item.initialBalance,
        sumDebits: item.totalDebits,
        sumCredits: item.totalCredits,
        debitBalance: Math.round(debitBalance * 100) / 100,
        creditBalance: Math.round(creditBalance * 100) / 100,
      };
    });

    return {
      startDate: filter.startDate,
      endDate: filter.endDate,
      costCenterId: filter.costCenterId || null,
      totalSumDebits: Math.round(totalSumDebits * 100) / 100,
      totalSumCredits: Math.round(totalSumCredits * 100) / 100,
      totalDebitBalances: Math.round(totalDebitBalances * 100) / 100,
      totalCreditBalances: Math.round(totalCreditBalances * 100) / 100,
      isBalanced: Math.abs(totalDebitBalances - totalCreditBalances) < 0.05,
      rows,
    };
  }

  /**
   * Estado de Resultados (P&L)
   */
  async getIncomeStatement(filter: ReportDateFilter) {
    const start = new Date(filter.startDate);
    const end = new Date(filter.endDate);

    const accounts = await this.prisma.account.findMany({
      where: {
        type: { in: ['REVENUE', 'COST', 'EXPENSE'] },
        allowsMovement: true,
      },
      orderBy: { code: 'asc' },
    });

    const revenues: any[] = [];
    const costs: any[] = [];
    const expenses: any[] = [];

    let totalRevenue = 0;
    let totalCost = 0;
    let totalExpense = 0;

    for (const acc of accounts) {
      const linesWhere: any = {
        accountId: acc.id,
        entry: {
          status: 'POSTED',
          date: { gte: start, lte: end },
        },
      };
      if (filter.costCenterId) {
        linesWhere.costCenterId = filter.costCenterId;
      }

      const lines = await this.prisma.journalEntryLine.findMany({
        where: linesWhere,
        select: { debit: true, credit: true },
      });

      if (lines.length === 0) continue;

      let netAmount = 0;
      for (const l of lines) {
        if (acc.nature === 'CREDIT') {
          netAmount += Number(l.credit) - Number(l.debit);
        } else {
          netAmount += Number(l.debit) - Number(l.credit);
        }
      }

      netAmount = Math.round(netAmount * 100) / 100;
      if (netAmount === 0) continue;

      const item = {
        code: acc.code,
        name: acc.name,
        amount: netAmount,
      };

      if (acc.type === 'REVENUE') {
        revenues.push(item);
        totalRevenue += netAmount;
      } else if (acc.type === 'COST') {
        costs.push(item);
        totalCost += netAmount;
      } else if (acc.type === 'EXPENSE') {
        expenses.push(item);
        totalExpense += netAmount;
      }
    }

    const grossProfit = Math.round((totalRevenue - totalCost) * 100) / 100;
    const netOperatingProfit = Math.round((grossProfit - totalExpense) * 100) / 100;

    return {
      startDate: filter.startDate,
      endDate: filter.endDate,
      costCenterId: filter.costCenterId || null,
      revenues: {
        items: revenues,
        total: Math.round(totalRevenue * 100) / 100,
      },
      costs: {
        items: costs,
        total: Math.round(totalCost * 100) / 100,
      },
      grossProfit,
      expenses: {
        items: expenses,
        total: Math.round(totalExpense * 100) / 100,
      },
      netOperatingProfit,
    };
  }
}
