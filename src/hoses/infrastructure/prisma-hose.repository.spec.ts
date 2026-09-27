import { PrismaHoseRepository } from './prisma-hose.repository';

describe('PrismaHoseRepository', () => {
  let repo: PrismaHoseRepository;
  let boHose: { findMany: jest.Mock; update: jest.Mock };

  const fakeHose = { id: 'hose-1', pumpId: 1, hoseId: 1, unitPrice: 100 };

  beforeEach(() => {
    jest.clearAllMocks();
    boHose = {
      findMany: jest.fn().mockResolvedValue([fakeHose]),
      update: jest.fn().mockResolvedValue({ ...fakeHose, unitPrice: 150 }),
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
    it('should update the unit price of a hose', async () => {
      const result = await repo.updatePrice('hose-1', 150);
      expect(result.unitPrice).toBe(150);
      expect(boHose.update).toHaveBeenCalledWith({
        where: { id: 'hose-1' },
        data: { unitPrice: 150 },
      });
    });
  });
});
