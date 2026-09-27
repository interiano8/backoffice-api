import { Module } from '@nestjs/common';
import { EtlService } from './etl.service';
import { PrismaEtlLockRepository } from './infrastructure/prisma-etl-lock.repository';
import { PrismaEtlSyncRepository } from './infrastructure/prisma-etl-sync.repository';
import { PrismaStoreRepository } from './infrastructure/prisma-store.repository';
import { PrismaHoseSyncRepository } from './infrastructure/prisma-hose-sync.repository';
import { PrismaShiftSyncRepository } from './infrastructure/prisma-shift-sync.repository';
import { PrismaSaleSyncRepository } from './infrastructure/prisma-sale-sync.repository';
import { PrismaPaymentSyncRepository } from './infrastructure/prisma-payment-sync.repository';
import { EtlCronTask } from './infrastructure/tasks/etl-cron.task';
import { EtlController } from './etl.controller';
import { AuditModule } from '../audit/audit.module';
import { StoresModule } from '../stores/stores.module';

import { ETL_USE_CASE } from './etl.tokens';

@Module({
  imports: [AuditModule, StoresModule],
  providers: [
    EtlService,
    { provide: ETL_USE_CASE, useExisting: EtlService },
    EtlCronTask,
    PrismaEtlLockRepository,
    PrismaEtlSyncRepository,
    PrismaHoseSyncRepository,
    PrismaShiftSyncRepository,
    PrismaSaleSyncRepository,
    PrismaPaymentSyncRepository,
    { provide: 'EtlLockRepository', useClass: PrismaEtlLockRepository },
    { provide: 'EtlSyncRepository', useClass: PrismaEtlSyncRepository },
    { provide: 'StoreRepository', useClass: PrismaStoreRepository },
  ],
  controllers: [EtlController],
  exports: [ETL_USE_CASE, EtlService],
})
export class EtlModule {}
