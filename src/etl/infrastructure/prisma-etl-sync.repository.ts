import { Injectable } from '@nestjs/common';
import type {
  EtlRepository,
  HoseConfiguration,
} from '../domain/ports/etl-repository.interface';
import type { DbExecutor } from '../../common/connections/db-executor.interface';
import { PrismaHoseSyncRepository } from './prisma-hose-sync.repository';
import { PrismaShiftSyncRepository } from './prisma-shift-sync.repository';
import { PrismaSaleSyncRepository } from './prisma-sale-sync.repository';
import { PrismaPaymentSyncRepository } from './prisma-payment-sync.repository';

@Injectable()
export class PrismaEtlSyncRepository implements EtlRepository {
  constructor(
    private readonly hoseRepo: PrismaHoseSyncRepository,
    private readonly shiftRepo: PrismaShiftSyncRepository,
    private readonly saleRepo: PrismaSaleSyncRepository,
    private readonly paymentRepo: PrismaPaymentSyncRepository,
  ) {}

  getHoseConfiguration(storeCode: string): Promise<HoseConfiguration> {
    return this.hoseRepo.getHoseConfiguration(storeCode);
  }

  syncHoses(pool: DbExecutor, storeCode: string): Promise<void> {
    return this.hoseRepo.syncHoses(pool, storeCode);
  }

  syncTpvShifts(
    pool: DbExecutor,
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void> {
    return this.shiftRepo.syncTpvShifts(
      pool,
      storeCode,
      specificDate,
      reconcilerShiftId,
    );
  }

  syncSaleHeaders(
    pool: DbExecutor,
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void> {
    return this.saleRepo.syncSaleHeaders(
      pool,
      storeCode,
      specificDate,
      reconcilerShiftId,
    );
  }

  syncTpvSales(
    pool: DbExecutor,
    storeCode: string,
    configMaps?: HoseConfiguration,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void> {
    return this.saleRepo.syncTpvSales(
      pool,
      storeCode,
      configMaps,
      specificDate,
      reconcilerShiftId,
    );
  }

  syncPaymentMethods(
    pool: DbExecutor,
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void> {
    return this.paymentRepo.syncPaymentMethods(
      pool,
      storeCode,
      specificDate,
      reconcilerShiftId,
    );
  }

  updateShiftTotals(
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void> {
    return this.shiftRepo.updateShiftTotals(
      storeCode,
      specificDate,
      reconcilerShiftId,
    );
  }
}
