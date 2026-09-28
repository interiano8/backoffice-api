import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountsService } from './accounts/accounts.service';
import { AccountsController } from './accounts/accounts.controller';
import { CostCentersService } from './cost-centers/cost-centers.service';
import { CostCentersController } from './cost-centers/cost-centers.controller';
import { FiscalPeriodsService } from './fiscal-periods/fiscal-periods.service';
import { FiscalPeriodsController } from './fiscal-periods/fiscal-periods.controller';
import { AccountingMappingService } from './mapping/accounting-mapping.service';
import { AccountingMappingController } from './mapping/accounting-mapping.controller';
import { JournalEntriesService } from './entries/journal-entries.service';
import { JournalEntriesController } from './entries/journal-entries.controller';
import { ShiftAccountingGenerator } from './generators/shift-accounting.generator';
import { CustomerAccountingService } from './customers/customer-accounting.service';
import { CustomerAccountingController } from './customers/customer-accounting.controller';
import { AccountingReportsService } from './reports/accounting-reports.service';
import { AccountingReportsController } from './reports/accounting-reports.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    AccountsController,
    CostCentersController,
    FiscalPeriodsController,
    AccountingMappingController,
    JournalEntriesController,
    CustomerAccountingController,
    AccountingReportsController,
  ],
  providers: [
    AccountsService,
    CostCentersService,
    FiscalPeriodsService,
    AccountingMappingService,
    JournalEntriesService,
    ShiftAccountingGenerator,
    CustomerAccountingService,
    AccountingReportsService,
  ],
  exports: [
    AccountsService,
    CostCentersService,
    FiscalPeriodsService,
    AccountingMappingService,
    JournalEntriesService,
    ShiftAccountingGenerator,
    CustomerAccountingService,
    AccountingReportsService,
  ],
})
export class AccountingModule {}
