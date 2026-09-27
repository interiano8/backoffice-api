import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { EtlService } from '../../etl.service';
import { StoreHealthService } from '../../../stores/store-health.service';

export interface AutoSyncStatus {
  running: boolean;
  storeCode: string | null;
  sinceDate: string | null;
  lastRun: string | null;
  lastResult: string | null;
}

@Injectable()
export class EtlCronTask {
  private readonly logger = new Logger(EtlCronTask.name);
  private status: AutoSyncStatus = {
    running: false,
    storeCode: null,
    sinceDate: null,
    lastRun: null,
    lastResult: null,
  };
  private lastSyncTimes = new Map<string, number>();

  constructor(
    private readonly etlService: EtlService,
    private readonly prisma: PrismaService,
    private readonly storeHealthService: StoreHealthService,
  ) {}

  getStatus(): AutoSyncStatus {
    return { ...this.status };
  }

  @Cron(process.env.ETL_CRON_SCHEDULE || '*/2 * * * *')
  async handleAutoSync() {
    try {
      const stores = await this.prisma.boStore.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      });

      if (!stores || stores.length === 0) {
        return;
      }

      const now = Date.now();

      for (const store of stores) {
        if (!store.code) continue;

        // 1. Health check & Ping
        const health = await this.storeHealthService.checkStoreHealth(store);
        if (health.healthStatus === 'OFFLINE') {
          this.logger.debug(`Store ${store.code} is OFFLINE. Skipping ETL sync.`);
          continue;
        }

        // 2. Check if sync is due
        const syncMinutes = store.SyncMinutes && store.SyncMinutes > 0 ? store.SyncMinutes : 5;
        const intervalMs = syncMinutes * 60 * 1000;
        const lastSync = this.lastSyncTimes.get(store.code) || (store.lastSyncAt ? new Date(store.lastSyncAt).getTime() : 0);

        if (now - lastSync < intervalMs) {
          continue;
        }

        this.logger.log(`Running background auto-sync for store ${store.code} (${store.name})...`);
        this.lastSyncTimes.set(store.code, now);

        this.status = {
          running: true,
          storeCode: store.code,
          sinceDate: null,
          lastRun: new Date().toISOString(),
          lastResult: null,
        };

        // Mark as SYNCING in DB
        await this.prisma.boStore.update({
          where: { id: store.id },
          data: { healthStatus: 'SYNCING' },
        }).catch(() => {});

        try {
          const result = await this.etlService.syncSales(store.code);
          const syncSuccess = Boolean(result.success);
          const syncResultMsg = syncSuccess ? 'OK' : (result.error || result.message || 'Error en sincronización');

          await this.prisma.boStore.update({
            where: { id: store.id },
            data: {
              healthStatus: 'ONLINE',
              lastSyncAt: new Date(),
              lastSyncStatus: syncSuccess ? 'SUCCESS' : 'FAILED',
              lastSyncError: syncSuccess ? null : syncResultMsg,
            },
          });

          this.status = {
            ...this.status,
            running: false,
            lastRun: new Date().toISOString(),
            lastResult: syncResultMsg,
          };

          this.logger.log(`Background auto-sync completed for store ${store.code}: ${syncResultMsg}`);
        } catch (storeError: any) {
          await this.prisma.boStore.update({
            where: { id: store.id },
            data: {
              healthStatus: 'ERROR',
              lastSyncAt: new Date(),
              lastSyncStatus: 'ERROR',
              lastSyncError: storeError.message,
            },
          }).catch(() => {});

          this.status = {
            ...this.status,
            running: false,
            lastRun: new Date().toISOString(),
            lastResult: storeError.message,
          };
          this.logger.error(`Error during auto-sync for store ${store.code}: ${storeError.message}`);
        }
      }

      this.status = { ...this.status, running: false };
    } catch (error: any) {
      this.logger.error(`Error in scheduled ETL cron cycle: ${error.message}`);
    }
  }
}
