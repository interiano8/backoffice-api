import { PrismaHoseRepository } from './prisma-hose.repository';

describe('PrismaHoseRepository', () => {
  let repo: PrismaHoseRepository;
  let boHose: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock; upsert: jest.Mock; delete: jest.Mock };

  const fakeHose = { id: 'hose-1', pumpId: 1, hoseId: 1 };

  beforeEach(() => {
    jest.clearAllMocks();
    boHose = {
      findMany: jest.fn().mockResolvedValue([fakeHose]),
      findFirst: jest.fn().mockResolvedValue(fakeHose),
      update: jest.fn().mockResolvedValue(fakeHose),
      upsert: jest.fn().mockResolvedValue({ ...fakeHose, gradeName: 'Gasolina Superior' }),
      delete: jest.fn().mockResolvedValue(fakeHose),
    };
    repo = new PrismaHoseRepository({ boHose } as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('findByStore', () => {
    it('should find active hoses ordered by pump and hose', async () => {
      await expect(repo.findByStore('S01')).resolves.toEqual([fakeHose]);
      expect(boHose.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01', active: true },
        orderBy: [{ pumpId: 'asc' }, { hoseId: 'asc' }],
      });
    });

    it('should return an empty array when no hoses exist', async () => {
      boHose.findMany.mockResolvedValue([]);
      await expect(repo.findByStore('S01')).resolves.toEqual([]);
    });
  });

  describe('updatePrice', () => {
    it('should handle updatePrice', async () => {
      const result = await repo.updatePrice('hose-1', 150);
      expect(result).toBeDefined();
    });
  });

  describe('create', () => {
    it('should upsert a hose', async () => {
      const data = {
        storeCode: 'S01',
        pumpId: 1,
        hoseId: 1,
        gradeName: 'Gasolina Superior',
        unitPrice: 120,
      };
      const result = await repo.create(data);
      expect(boHose.upsert).toHaveBeenCalled();
      expect(result.gradeName).toBe('Gasolina Superior');
    });
  });

  describe('delete', () => {
    it('should delete a hose by id', async () => {
      await repo.delete('hose-1');
      expect(boHose.delete).toHaveBeenCalledWith({ where: { id: 'hose-1' } });
    });
  });
});
