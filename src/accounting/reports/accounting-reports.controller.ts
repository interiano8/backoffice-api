import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AccountingReportsService } from './accounting-reports.service';

@Controller('accounting/reports')
@UseGuards(JwtAuthGuard)
export class AccountingReportsController {
  constructor(private readonly reportsService: AccountingReportsService) {}

  @Get('journal-book')
  async getJournalBook(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('costCenterId') costCenterId?: string,
  ) {
    return this.reportsService.getJournalBook({
      startDate: startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      endDate: endDate || new Date().toISOString(),
      costCenterId,
    });
  }

  @Get('general-ledger')
  async getGeneralLedger(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('accountId') accountId?: string,
    @Query('costCenterId') costCenterId?: string,
  ) {
    return this.reportsService.getGeneralLedger({
      startDate: startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      endDate: endDate || new Date().toISOString(),
      accountId,
      costCenterId,
    });
  }

  @Get('trial-balance')
  async getTrialBalance(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('costCenterId') costCenterId?: string,
  ) {
    return this.reportsService.getTrialBalance({
      startDate: startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      endDate: endDate || new Date().toISOString(),
      costCenterId,
    });
  }

  @Get('income-statement')
  async getIncomeStatement(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('costCenterId') costCenterId?: string,
  ) {
    return this.reportsService.getIncomeStatement({
      startDate: startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      endDate: endDate || new Date().toISOString(),
      costCenterId,
    });
  }
}
