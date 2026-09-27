import { PrismaAuthRepository } from './prisma-auth.repository';

describe('PrismaAuthRepository', () => {
  let repo: PrismaAuthRepository;
  let boStore: { findUnique: jest.Mock };

  const store = { id: 's-1', code: 'S01', ip: '10.0.0.1' };

  beforeEach(() => {
    jest.clearAllMocks();
    boStore = { findUnique: jest.fn().mockResolvedValue(store) };
    repo = new PrismaAuthRepository({ boStore } as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('findStoreByCode', () => {
    it('should return a mapped store when found', async () => {
      await expect(repo.findStoreByCode('S01')).resolves.toEqual({
        id: 's-1',
        code: 'S01',
        ip: '10.0.0.1',
      });
      expect(boStore.findUnique).toHaveBeenCalledWith({ where: { code: 'S01' } });
    });

    it('should return null when the store does not exist', async () => {
      boStore.findUnique.mockResolvedValue(null);
      await expect(repo.findStoreByCode('S01')).resolves.toBeNull();
    });
  });

  describe('findStoreById', () => {
    it('should return a mapped store when found', async () => {
      await expect(repo.findStoreById('s-1')).resolves.toEqual({
        id: 's-1',
        code: 'S01',
        ip: '10.0.0.1',
      });
      expect(boStore.findUnique).toHaveBeenCalledWith({ where: { id: 's-1' } });
    });

    it('should return null when the store does not exist', async () => {
      boStore.findUnique.mockResolvedValue(null);
      await expect(repo.findStoreById('missing')).resolves.toBeNull();
    });
  });

  describe('findEmployee', () => {
    it('should always return null', async () => {
      await expect(repo.findEmployee('user', 'S01')).resolves.toBeNull();
    });
  });
});