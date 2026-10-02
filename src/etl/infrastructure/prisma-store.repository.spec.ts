import { PrismaStoreRepository } from './prisma-store.repository';

describe('PrismaStoreRepository', () => {
  let repo: PrismaStoreRepository;
  let boStore: { findUnique: jest.Mock };

  const store = { id: 's-1', code: 'S01', ip: '10.0.0.1', name: 'Store 1' };

  beforeEach(() => {
    jest.clearAllMocks();
    boStore = { findUnique: jest.fn().mockResolvedValue(store) };
    repo = new PrismaStoreRepository({ boStore } as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('findByCode', () => {
    it('should return a mapped store when found', async () => {
      await expect(repo.findByCode('S01')).resolves.toEqual({
        id: 's-1',
        code: 'S01',
        ip: '10.0.0.1',
        name: 'Store 1',
      });
      expect(boStore.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: 'S01' } }),
      );
    });

    it('should return null when the store does not exist', async () => {
      boStore.findUnique.mockResolvedValue(null);
      await expect(repo.findByCode('S01')).resolves.toBeNull();
    });
  });
});