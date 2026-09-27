import { PrismaUserRepository } from './prisma-user.repository';

describe('PrismaUserRepository', () => {
  let repo: PrismaUserRepository;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const user = {
    id: 'u-1',
    username: 'admin',
    name: 'Admin',
    email: 'a@b.com',
    role: 'ADMIN',
    isActive: true,
    password: 'secret',
  };

  const mapped = {
    id: 'u-1',
    username: 'admin',
    name: 'Admin',
    email: 'a@b.com',
    role: 'ADMIN',
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([user]),
        findUnique: jest.fn().mockResolvedValue(user),
        create: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
        delete: jest.fn().mockResolvedValue(user),
      },
    };
    repo = new PrismaUserRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('findAll', () => {
    it('should map users without password', async () => {
      await expect(repo.findAll()).resolves.toEqual([mapped]);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it('should map missing email to undefined', async () => {
      prisma.user.findMany.mockResolvedValue([{ ...user, email: null }]);
      const result = await repo.findAll();
      expect(result[0].email).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should return a mapped user when found', async () => {
      await expect(repo.findById('u-1')).resolves.toEqual(mapped);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u-1' } });
    });

    it('should return null when not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(repo.findById('u-1')).resolves.toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should return a mapped user when found', async () => {
      await expect(repo.findByUsername('admin')).resolves.toEqual(mapped);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'admin' } });
    });

    it('should return null when not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(repo.findByUsername('admin')).resolves.toBeNull();
    });
  });

  describe('findByUsernameWithPassword', () => {
    it('should include the password hash', async () => {
      const result = await repo.findByUsernameWithPassword('admin');
      expect(result).toEqual({ ...mapped, password: 'secret' });
    });

    it('should return null when not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(repo.findByUsernameWithPassword('admin')).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('should create and map the user', async () => {
      await expect(repo.create({ username: 'new' })).resolves.toEqual(mapped);
      expect(prisma.user.create).toHaveBeenCalledWith({ data: { username: 'new' } });
    });
  });

  describe('update', () => {
    it('should update and map the user', async () => {
      await expect(repo.update('u-1', { name: 'New' })).resolves.toEqual(mapped);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { name: 'New' },
      });
    });
  });

  describe('remove', () => {
    it('should delete the user', async () => {
      await expect(repo.remove('u-1')).resolves.toBeUndefined();
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u-1' } });
    });
  });
});