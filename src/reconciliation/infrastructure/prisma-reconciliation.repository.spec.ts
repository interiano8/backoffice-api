import { PrismaReconciliationRepository } from './prisma-reconciliation.repository';

describe('PrismaReconciliationRepository', () => {
  let repo: PrismaReconciliationRepository;
  let boReconciliation: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };

  const fakeRecord = { id: 'rec-1', storeCode: 'S01', createdAt: new Date() };

  beforeEach(() => {
    jest.clearAllMocks();
    boReconciliation = {
      create: jest.fn().mockResolvedValue(fakeRecord),
      findMany: jest.fn().mockResolvedValue([fakeRecord]),
      findUnique: jest.fn().mockResolvedValue(fakeRecord),
    };
    repo = new PrismaReconciliationRepository({
      boReconciliation,
    } as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('create', () => {
    it('should create a reconciliation record', async () => {
      const data = { storeCode: 'S01', shiftId: 'shift-1' };
      await expect(repo.create(data)).resolves.toEqual(fakeRecord);
      expect(boReconciliation.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('findAll', () => {
    it('should filter by storeCode when provided', async () => {
      await expect(repo.findAll('S01')).resolves.toEqual([fakeRecord]);
      expect(boReconciliation.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should query without where when no storeCode is provided', async () => {
      await expect(repo.findAll()).resolves.toEqual([fakeRecord]);
      expect(boReconciliation.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should find a reconciliation by id', async () => {
      await expect(repo.findOne('rec-1')).resolves.toEqual(fakeRecord);
      expect(boReconciliation.findUnique).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
      });
    });

    it('should resolve null when record does not exist', async () => {
      boReconciliation.findUnique.mockResolvedValue(null);
      await expect(repo.findOne('missing')).resolves.toBeNull();
    });
  });
});
