export interface EtlLockRepository {
  acquireLock(lockKey: string): Promise<boolean>;
  releaseLock(lockKey: string): Promise<void>;
  isLocked(lockKey: string): Promise<boolean>;
  waitForStoreLock(
    storeCode: string,
    lockKey: string,
    reconcilerShiftId: string,
    maxAttempts?: number,
  ): Promise<boolean>;
}
