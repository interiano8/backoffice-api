import { Logger } from '@nestjs/common';
import { PrismaAuditRepository } from './prisma-audit.repository';

describe('PrismaAuditRepository', () => {
  let repo: PrismaAuditRepository;
  let prisma: { activityLog: { create: jest.Mock; findMany: jest.Mock } };

  const entry = {
    action: 'LOGIN',
    entity: 'user',
    entityId: 'u-1',
    storeCode: 'S01',
    userId: 'u-1',
    metadata: '{"ip":"1.2.3.4"}',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = {
      activityLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    repo = new PrismaAuditRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('record', () => {
    it('should create an activity log entry', async () => {
      await expect(repo.record(entry)).resolves.toBeUndefined();
      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: entry,
      });
    });

    it('should warn and swallow errors when persisting fails', async () => {
      prisma.activityLog.create.mockRejectedValue(new Error('db down'));
      await expect(repo.record(entry)).resolves.toBeUndefined();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not save activity log'),
      );
    });
  });

  describe('findAll', () => {
    it('should build a where clause from filters', async () => {
      const rows = [{ id: 'log-1' }];
      prisma.activityLog.findMany.mockResolvedValue(rows);

      const result = await repo.findAll({
        entity: 'user',
        entityId: 'u-1',
        storeCode: 'S01',
        userId: 'u-1',
        action: 'LOGIN',
        limit: '25',
      });

      expect(result).toEqual(rows);
      expect(prisma.activityLog.findMany).toHaveBeenCalledWith({
        where: {
          entity: 'user',
          entityId: 'u-1',
          storeCode: 'S01',
          userId: 'u-1',
          action: 'LOGIN',
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });
    });

    it('should default the limit to 100 and use empty where', async () => {
      await repo.findAll();
      expect(prisma.activityLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });

    it('should warn and return an empty array on error', async () => {
      prisma.activityLog.findMany.mockRejectedValue(new Error('boom'));
      await expect(repo.findAll({})).resolves.toEqual([]);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not query activity logs'),
      );
    });
  });
});