import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IAuditUseCase } from '../audit/domain/ports/in/audit.use-case.port';
import { AUDIT_USE_CASE } from '../audit/audit.tokens';
import type { IConnectionFactory } from '../common/connections/connection-factory.interface';
import type { EtlLockRepository } from './domain/ports/etl-lock-repository.interface';
import type { EtlRepository } from './domain/ports/etl-repository.interface';
import type { StoreRepository } from './domain/ports/store-repository.interface';

import type { IEtlUseCase } from './domain/ports/in/etl.use-case.port';

@Injectable()
export class EtlService implements IEtlUseCase {
  private readonly logger = new Logger(EtlService.name);

  constructor(
    @Inject('IConnectionFactory')
    private readonly connectionFactory: IConnectionFactory,
    @Inject('EtlLockRepository') private readonly etlLock: EtlLockRepository,
    @Inject('EtlSyncRepository') private readonly etlSync: EtlRepository,
    @Inject('StoreRepository') private readonly storeRepo: StoreRepository,
    @Inject(AUDIT_USE_CASE)
    private auditUseCase: IAuditUseCase,
  ) {}

  async syncSales(storeCode: string) {
    const lockKey = `sync_store_${storeCode}`;
    if (await this.etlLock.isLocked(lockKey)) {
      return {
        success: false,
        error: 'Ya existe una sincronizacion en curso para esta tienda.',
      };
    }
    await this.etlLock.acquireLock(lockKey);

    const store = await this.storeRepo.findByCode(storeCode);
    if (!store) {
      await this.etlLock.releaseLock(lockKey);
      return { success: false, error: `Store ${storeCode} not found` };
    }

    try {
      await this.syncTpv(store.code);
      await this.auditUseCase.record({
        action: 'SYNC_COMPLETED',
        entity: 'ETL',
        storeCode,
      });
      return { success: true, message: 'Sync completed' };
    } catch (error: any) {
      this.logger.error('Sync failed', error);
      await this.auditUseCase.record({
        action: 'SYNC_FAILED',
        entity: 'ETL',
        storeCode,
        metadata: error.message,
      });
      return { success: false, error: error.message };
    } finally {
      await this.etlLock.releaseLock(lockKey);
    }
  }

  async syncByReconcilerShiftId(storeCode: string, reconcilerShiftId: string) {
    const lockKey = `sync_shift_${reconcilerShiftId}`;
    const storeLockKey = `sync_store_${storeCode}`;

    const shiftLocked = await this.etlLock.acquireLock(lockKey);
    if (!shiftLocked) {
      return {
        success: false,
        error: 'Este turno ya se esta sincronizando actualmente.',
      };
    }

    const storeLocked = await this.etlLock.waitForStoreLock(
      storeCode,
      storeLockKey,
      reconcilerShiftId,
    );
    if (!storeLocked) {
      await this.etlLock.releaseLock(lockKey);
      return {
        success: false,
        error: 'Tiempo de espera agotado: La tienda sigue ocupada.',
      };
    }

    const store = await this.storeRepo.findByCode(storeCode);
    if (!store) {
      await this.etlLock.releaseLock(lockKey);
      await this.etlLock.releaseLock(storeLockKey);
      return { success: false, error: `Store ${storeCode} not found` };
    }

    try {
      await this.syncTpvByReconcilerShiftId(store.code, reconcilerShiftId);
      return {
        success: true,
        message: `Sync completed for shift ${reconcilerShiftId}`,
      };
    } catch (error: any) {
      this.logger.error('Selective sync failed', error);
      return { success: false, error: error.message };
    } finally {
      await this.etlLock.releaseLock(lockKey);
      await this.etlLock.releaseLock(storeLockKey);
    }
  }

  async syncMultipleShifts(
    storeCode: string,
    reconcilerShiftIds: string[],
  ) {
    const storeLockKey = `sync_store_${storeCode}`;

    const storeLocked = await this.etlLock.acquireLock(storeLockKey);
    if (!storeLocked) {
      return {
        success: false,
        error: 'Ya existe una sincronizacion en curso para esta tienda.',
      };
    }

    const store = await this.storeRepo.findByCode(storeCode);
    if (!store) {
      await this.etlLock.releaseLock(storeLockKey);
      return { success: false, error: `Store ${storeCode} not found` };
    }

    const results: any[] = [];

    try {
      for (const reconcilerShiftId of reconcilerShiftIds) {
        try {
          await this.syncTpvByReconcilerShiftId(store.code, reconcilerShiftId);
          results.push({
            reconcilerShiftId,
            success: true,
            message: `Sync completed for shift ${reconcilerShiftId}`,
          });
        } catch (error: any) {
          this.logger.error(
            `Selective sync failed for shift ${reconcilerShiftId}`,
            error,
          );
          results.push({
            reconcilerShiftId,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        success: results.every((r) => r.success),
        results,
        synced: results.filter((r) => r.success).length,
        errors: results.filter((r) => !r.success).length,
      };
    } finally {
      await this.etlLock.releaseLock(storeLockKey);
    }
  }

  async getHoseConfiguration(storeCode: string) {
    return this.etlSync.getHoseConfiguration(storeCode);
  }

  private async syncTpv(storeCode: string) {
    const pool = await this.connectionFactory.getTpvConnection(storeCode);
    try {
      await this.etlSync.syncHoses(pool, storeCode);
      const configMaps = await this.etlSync.getHoseConfiguration(storeCode);
      await this.etlSync.syncTpvShifts(pool, storeCode);
      await this.etlSync.syncSaleHeaders(pool, storeCode);
      await this.etlSync.syncTpvSales(pool, storeCode, configMaps);
      await this.etlSync.syncPaymentMethods(pool, storeCode);
      await this.etlSync.updateShiftTotals(storeCode);
    } finally {
      await pool.close();
    }
  }

  private async syncTpvByReconcilerShiftId(
    storeCode: string,
    reconcilerShiftId: string,
  ) {
    const pool = await this.connectionFactory.getTpvConnection(storeCode);
    try {
      await this.etlSync.syncHoses(pool, storeCode);
      const configMaps = await this.etlSync.getHoseConfiguration(storeCode);
      await this.etlSync.syncTpvShifts(
        pool,
        storeCode,
        undefined,
        reconcilerShiftId,
      );
      await this.etlSync.syncSaleHeaders(
        pool,
        storeCode,
        undefined,
        reconcilerShiftId,
      );
      await this.etlSync.syncTpvSales(
        pool,
        storeCode,
        configMaps,
        undefined,
        reconcilerShiftId,
      );
      await this.etlSync.syncPaymentMethods(
        pool,
        storeCode,
        undefined,
        reconcilerShiftId,
      );
      await this.etlSync.updateShiftTotals(
        storeCode,
        undefined,
        reconcilerShiftId,
      );
    } finally {
      await pool.close();
    }
  }
}
