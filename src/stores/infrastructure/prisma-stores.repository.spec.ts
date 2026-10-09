import { Logger } from '@nestjs/common';
import { Client } from 'pg';
import { PrismaStoresRepository } from './prisma-stores.repository';

jest.mock('pg', () => ({ Client: jest.fn() }));

describe('PrismaStoresRepository', () => {
  let repo: PrismaStoresRepository;
  let prisma: {
    boStore: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const store = { id: 's-1', code: 'S01', name: 'Store 1', dbPassword: 'secretPassword' };
  const sanitizedStore = { id: 's-1', code: 'S01', name: 'Store 1', hasDbPassword: true };

  beforeEach(() => {
    jest.clearAllMocks();
    (Client as unknown as jest.Mock).mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
      end: jest.fn().mockResolvedValue(undefined),
    }));
    prisma = {
      boStore: {
        findMany: jest.fn().mockResolvedValue([store]),
        findUnique: jest.fn().mockResolvedValue(store),
        create: jest.fn().mockResolvedValue(store),
        update: jest.fn().mockResolvedValue(store),
        delete: jest.fn().mockResolvedValue(store),
      },
    };
    repo = new PrismaStoresRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all stores ordered by code and sanitize dbPassword', async () => {
      await expect(repo.findAll()).resolves.toEqual([sanitizedStore]);
      expect(prisma.boStore.findMany).toHaveBeenCalledWith({
        orderBy: { code: 'asc' },
      });
    });
  });

  describe('findAllBasic', () => {
    it('should select basic active store fields', async () => {
      await expect(repo.findAllBasic()).resolves.toEqual([store]);
      expect(prisma.boStore.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          titulo: true,
          RTN: true,
          address: true,
          logoUrl: true,
          isActive: true,
          apiUrl: true,
          lanUrl: true,
          moduleCustomers: true,
          moduleAccounting: true,
          printCreditInvoices: true,
          SyncMinutes: true,
          PresentationMinutes: true,
          validarSaldoCredito: true,
          businessType: true,
        },
        orderBy: { code: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should find a store by id and sanitize dbPassword', async () => {
      await expect(repo.findOne('s-1')).resolves.toEqual(sanitizedStore);
      expect(prisma.boStore.findUnique).toHaveBeenCalledWith({ where: { id: 's-1' } });
    });
  });

  describe('findByCode', () => {
    it('should find a store by code and sanitize dbPassword', async () => {
      await expect(repo.findByCode('S01')).resolves.toEqual(sanitizedStore);
      expect(prisma.boStore.findUnique).toHaveBeenCalledWith({ where: { code: 'S01' } });
    });
  });

  describe('create', () => {
    it('should create a store and return sanitized entity', async () => {
      await expect(repo.create(store)).resolves.toEqual(sanitizedStore);
      expect(prisma.boStore.create).toHaveBeenCalledWith({ data: store });
    });
  });

  describe('update', () => {
    it('should update a store and omit empty dbPassword', async () => {
      await expect(repo.update('s-1', { name: 'New', dbPassword: '' })).resolves.toEqual(sanitizedStore);
      expect(prisma.boStore.update).toHaveBeenCalledWith({
        where: { id: 's-1' },
        data: {
          name: 'New',
          configVersion: { increment: 1 },
          configUpdatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('remove', () => {
    it('should delete a store', async () => {
      await expect(repo.remove('s-1')).resolves.toBeUndefined();
      expect(prisma.boStore.delete).toHaveBeenCalledWith({ where: { id: 's-1' } });
    });
  });

  describe('testConnection', () => {
    it('should return success when the connection works', async () => {
      const result = await repo.testConnection({
        ip: '10.0.0.5',
        dbPort: '5433',
        dbName: 'mydb',
        dbUser: 'admin',
        dbPassword: 'secret',
        dbSsl: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Conexión exitosa a PostgreSQL en 10.0.0.5');
      const config = (Client as unknown as jest.Mock).mock.calls[0][0];
      expect(config.host).toBe('10.0.0.5');
      expect(config.port).toBe(5433);
      expect(config.database).toBe('mydb');
      expect(config.user).toBe('admin');
      expect(config.password).toBe('secret');
      expect(config.ssl).toEqual({ rejectUnauthorized: false });
    });

    it('should apply default client options', async () => {
      const result = await repo.testConnection({});

      expect(result.success).toBe(true);
      const config = (Client as unknown as jest.Mock).mock.calls[0][0];
      expect(config.host).toBe('127.0.0.1');
      expect(config.port).toBe(5432);
      expect(config.database).toBe('prisma');
      expect(config.user).toBe('postgres');
      expect(config.password).toBeUndefined();
      expect(config.ssl).toBe(false);
    });

    it('should return an error when the connection fails', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      (Client as unknown as jest.Mock).mockImplementation(() => ({
        connect: jest.fn().mockRejectedValue(new Error('connection refused')),
      }));

      const result = await repo.testConnection({ ip: '10.0.0.9' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('connection refused');
      expect(errorSpy).toHaveBeenCalledWith('Connection test failed: connection refused');
    });
  });
});