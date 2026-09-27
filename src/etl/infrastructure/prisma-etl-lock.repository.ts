import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ETL } from '../../common/utils/constants';
import type { EtlLockRepository } from '../domain/ports/etl-lock-repository.interface';

@Injectable()
export class PrismaEtlLockRepository implements EtlLockRepository {
  private readonly logger = new Logger(PrismaEtlLockRepository.name);

  constructor(private prisma: PrismaService) {
    this.clearStaleLocks().catch((e) =>
      this.logger.error(`Failed to clear stale locks on startup: ${e.message}`),
    );
  }

  private async clearStaleLocks() {
    const deleted = await this.prisma.boSyncLock.deleteMany({});
    if (deleted.count > 0) {
      this.logger.log(
        `Cleared ${deleted.count} stale lock(s) from previous process on startup`,
      );
    }
  }

  async acquireLock(lockKey: string): Promise<boolean> {
    try {
      await this.cleanExpiredLocks();
      await this.prisma.boSyncLock.create({ data: { lockKey } });
      return true;
    } catch (e: any) {
      if (e.code === 'P2002') {
        return false;
      }
      this.logger.error(`Error acquiring lock for ${lockKey}: ${e.message}`);
      return false;
    }
  }

  async releaseLock(lockKey: string): Promise<void> {
    try {
      await this.prisma.boSyncLock.delete({ where: { lockKey } });
    } catch {}
  }

  async isLocked(lockKey: string): Promise<boolean> {
    await this.cleanExpiredLocks();
    const lock = await this.prisma.boSyncLock.findUnique({
      where: { lockKey },
    });
    return !!lock;
  }

  async waitForStoreLock(
    storeCode: string,
    lockKey: string,
    reconcilerShiftId: string,
    maxAttempts = ETL.LOCK_MAX_ATTEMPTS,
  ): Promise<boolean> {
    let storeLocked = false;
    let attempts = 0;
    while (attempts < maxAttempts) {
      storeLocked = await this.acquireLock(lockKey);
      if (storeLocked) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
      if (attempts % 10 === 0) {
        this.logger.log(
          `Shift ${reconcilerShiftId} waiting for store ${storeCode} lock... (${attempts}s)`,
        );
      }
    }
    return storeLocked;
  }

  private async cleanExpiredLocks() {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - ETL.LOCK_EXPIRY_HOURS);
    await this.prisma.boSyncLock.deleteMany({
      where: { createdAt: { lt: oneHourAgo } },
    });
  }
}
