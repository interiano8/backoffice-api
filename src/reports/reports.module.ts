import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { PrismaReportRepository } from './infrastructure/prisma-report.repository';
import { PrismaStatementRepository } from './infrastructure/prisma-statement.repository';
import { PrismaDashboardRepository } from './infrastructure/prisma-dashboard.repository';
import { ReportsUseCase } from './application/use-cases/reports.use-case';
import { CustomerStatementUseCase } from './application/use-cases/customer-statement.use-case';
import { DashboardUseCase } from './application/use-cases/dashboard.use-case';
import { AuthModule } from '../auth/auth.module';
import {
  REPORT_REPOSITORY,
  STATEMENT_REPOSITORY,
  DASHBOARD_REPOSITORY,
  REPORTS_USE_CASE,
  CUSTOMER_STATEMENT_USE_CASE,
  DASHBOARD_USE_CASE,
} from './reports.tokens';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [
    { provide: REPORT_REPOSITORY, useClass: PrismaReportRepository },
    { provide: STATEMENT_REPOSITORY, useClass: PrismaStatementRepository },
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
    { provide: REPORTS_USE_CASE, useClass: ReportsUseCase },
    {
      provide: CUSTOMER_STATEMENT_USE_CASE,
      useClass: CustomerStatementUseCase,
    },
    { provide: DASHBOARD_USE_CASE, useClass: DashboardUseCase },
  ],
  exports: [REPORTS_USE_CASE, CUSTOMER_STATEMENT_USE_CASE, DASHBOARD_USE_CASE],
})
export class ReportsModule {}
