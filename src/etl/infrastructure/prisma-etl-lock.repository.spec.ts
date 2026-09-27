import { Logger } from '@nestjs/common';
import { PrismaEtlLockRepository } from './prisma-etl-lock.repository';

describe('PrismaEtlLockRepository', () => {
  let repo: PrismaEtlLockRepository;
  let boSyncLock: {
    deleteMany: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    findUnique: jest.Mock;
  };

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    jest.clearAllMocks();
    boSyncLock = {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ lockKey: 'lock-1' }),
      delete: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    };
    repo = new PrismaEtlLockRepository({ boSyncLock } as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('constructor', () => {
    it('should clear stale locks on startup when count > 0', async () => {
      const logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      boSyncLock.deleteMany.mockResolvedValue({ count: 3 });
      repo = new PrismaEtlLockRepository({ boSyncLock } as any);
      await flush();
      expect(boSyncLock.deleteMany).toHaveBeenCalledWith({});
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleared 3 stale lock'),
      );
      logSpy.mockRestore();
    });

    it('should log an error when startup cleanup fails', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      boSyncLock.deleteMany.mockRejectedValue(new Error('db down'));
      repo = new PrismaEtlLockRepository({ boSyncLock } as any);
      await flush();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clear stale locks on startup'),
      );
      errorSpy.mockRestore();
    });
  });

  describe('acquireLock', () => {
    it('should clean expired locks and return true on successful create', async () => {
      await expect(repo.acquireLock('lock-1')).resolves.toBe(true);
      expect(boSyncLock.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: expect.any(Date) } },
      });
      expect(boSyncLock.create).toHaveBeenCalledWith({
        data: { lockKey: 'lock-1' },
      });
    });

    it('should return false when create fails with a unique constraint error', async () => {
      boSyncLock.create.mockRejectedValue({ code: 'P2002' });
      await expect(repo.acquireLock('lock-1')).resolves.toBe(false);
    });

    it('should log and return false on an unexpected create error', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      boSyncLock.create.mockRejectedValue(new Error('boom'));
      await expect(repo.acquireLock('lock-1')).resolves.toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error acquiring lock for lock-1'),
      );
      errorSpy.mockRestore();
    });

    it('should return false when cleaning expired locks throws', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      boSyncLock.deleteMany.mockRejectedValue(new Error('cleanup boom'));
      await expect(repo.acquireLock('lock-1')).resolves.toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error acquiring lock for lock-1'),
      );
      errorSpy.mockRestore();
    });
  });

  describe('releaseLock', () => {
    it('should delete the lock by key', async () => {
      await expect(repo.releaseLock('lock-1')).resolves.toBeUndefined();
      expect(boSyncLock.delete).toHaveBeenCalledWith({
        where: { lockKey: 'lock-1' },
      });
    });

    it('should swallow errors when the lock does not exist', async () => {
      boSyncLock.delete.mockRejectedValue({ code: 'P2025' });
      await expect(repo.releaseLock('missing')).resolves.toBeUndefined();
    });
  });

  describe('isLocked', () => {
    it('should return true when a lock exists', async () => {
      boSyncLock.findUnique.mockResolvedValue({ id: '1', lockKey: 'lock-1' });
      await expect(repo.isLocked('lock-1')).resolves.toBe(true);
      expect(boSyncLock.findUnique).toHaveBeenCalledWith({
        where: { lockKey: 'lock-1' },
      });
    });

    it('should return false when no lock exists', async () => {
      await expect(repo.isLocked('lock-1')).resolves.toBe(false);
    });
  });

  describe('waitForStoreLock', () => {
    it('should return true immediately when the lock is acquired', async () => {
      await expect(
        repo.waitForStoreLock('S01', 'lock-1', 'shift-1', 3),
      ).resolves.toBe(true);
    });

    it('should retry until the lock is acquired', async () => {
      jest.useFakeTimers();
      try {
        const acquireSpy = jest
          .spyOn(repo, 'acquireLock')
          .mockResolvedValueOnce(false)
          .mockResolvedValue(true);

        const promise = repo.waitForStoreLock('S01', 'lock-1', 'shift-1', 3);
        await jest.advanceTimersByTimeAsync(1000);
        await expect(promise).resolves.toBe(true);
        expect(acquireSpy).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should return false when attempts are exhausted', async () => {
      jest.useFakeTimers();
      try {
        jest.spyOn(repo, 'acquireLock').mockResolvedValue(false);
        const promise = repo.waitForStoreLock('S01', 'lock-1', 'shift-1', 2);
        await jest.advanceTimersByTimeAsync(2000);
        await expect(promise).resolves.toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should log a waiting message every 10 attempts', async () => {
      const logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      jest.useFakeTimers();
      try {
        jest.spyOn(repo, 'acquireLock').mockResolvedValue(false);
        const promise = repo.waitForStoreLock('S01', 'lock-1', 'shift-1');
        await jest.advanceTimersByTimeAsync(120 * 1000);
        await expect(promise).resolves.toBe(false);
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Shift shift-1 waiting for store S01 lock... (10s)',
          ),
        );
      } finally {
        jest.useRealTimers();
        logSpy.mockRestore();
      }
    });
  });
});
