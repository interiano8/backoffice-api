import { Module, forwardRef } from '@nestjs/common';
import { ReconciliationUseCase } from './application/use-cases/reconciliation.use-case';
import { PrismaReconciliationRepository } from './infrastructure/prisma-reconciliation.repository';
import { ReconciliationController } from './reconciliation.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';
import { RECONCILIATION_USE_CASE, RECONCILIATION_REPOSITORY } from './reconciliation.tokens';
import { FiscalAuditService } from './application/services/fiscal-audit.service';
import { PermissionsGuard } from '../auth/rbac/permissions.guard';

@Module({
  imports: [PrismaModule, forwardRef(() => AlertsModule)],
  controllers: [ReconciliationController],
  providers: [
    { provide: RECONCILIATION_USE_CASE, useClass: ReconciliationUseCase },
    { provide: RECONCILIATION_REPOSITORY, useClass: PrismaReconciliationRepository },
    FiscalAuditService,
    PermissionsGuard,
  ],
  exports: [RECONCILIATION_USE_CASE, RECONCILIATION_REPOSITORY, FiscalAuditService],
})
export class ReconciliationModule {}

