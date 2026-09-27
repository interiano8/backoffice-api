import { ConflictException } from '@nestjs/common';
import { StoresUseCase } from './stores.use-case';
import type { StoresRepository } from '../../domain/ports/stores-repository.interface';
import type { IAuditUseCase } from '../../../audit/domain/ports/in/audit.use-case.port';

describe('StoresUseCase', () => {
  let useCase: StoresUseCase;
  let storesRepo: jest.Mocked<StoresRepository>;
  let auditUseCase: jest.Mocked<IAuditUseCase>;

  const mockStore = {
    id: 's-1',
    code: '001',
    name: 'Estación Central',
    ip: '192.168.1.10',
    hasDbPassword: true,
  };

  beforeEach(() => {
    storesRepo = {
      findAll: jest.fn().mockResolvedValue([mockStore]),
      findAllBasic: jest.fn().mockResolvedValue([mockStore]),
      findOne: jest.fn().mockResolvedValue(mockStore),
      findByCode: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockStore),
      update: jest.fn().mockResolvedValue(mockStore),
      remove: jest.fn().mockResolvedValue(undefined),
      testConnection: jest.fn().mockResolvedValue({ success: true, message: 'OK' }),
    };

    auditUseCase = {
      record: jest.fn().mockResolvedValue(undefined),
      findAll: jest.fn().mockResolvedValue([]),
    };

    useCase = new StoresUseCase(storesRepo, auditUseCase);
  });

  describe('create', () => {
    it('debe registrar la tienda y emitir evento STORE_CREATED', async () => {
      const result = await useCase.create({ code: '001', name: 'Estación Central' }, 'adminUser');

      expect(storesRepo.findByCode).toHaveBeenCalledWith('001');
      expect(storesRepo.create).toHaveBeenCalledWith({ code: '001', name: 'Estación Central' });
      expect(auditUseCase.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STORE_CREATED',
          entity: 'BoStore',
          entityId: '001',
          userId: 'adminUser',
        }),
      );
      expect(result).toEqual(mockStore);
    });

    it('debe lanzar ConflictException si el código ya existe', async () => {
      storesRepo.findByCode.mockResolvedValueOnce(mockStore);

      await expect(
        useCase.create({ code: '001', name: 'Duplicado' }, 'adminUser'),
      ).rejects.toThrow(ConflictException);

      expect(storesRepo.create).not.toHaveBeenCalled();
      expect(auditUseCase.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('debe actualizar la tienda y emitir evento STORE_UPDATED', async () => {
      const result = await useCase.update('s-1', { name: 'Nombre Modificado' }, 'adminUser');

      expect(storesRepo.update).toHaveBeenCalledWith('s-1', { name: 'Nombre Modificado' });
      expect(auditUseCase.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STORE_UPDATED',
          entity: 'BoStore',
          userId: 'adminUser',
        }),
      );
      expect(result).toEqual(mockStore);
    });

    it('debe lanzar ConflictException si el nuevo código pertenece a otra tienda', async () => {
      storesRepo.findByCode.mockResolvedValueOnce({ ...mockStore, id: 'other-id', code: '002' });

      await expect(
        useCase.update('s-1', { code: '002' }, 'adminUser'),
      ).rejects.toThrow(ConflictException);

      expect(storesRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('debe eliminar la tienda y emitir evento STORE_DELETED', async () => {
      await useCase.remove('s-1', 'adminUser');

      expect(storesRepo.findOne).toHaveBeenCalledWith('s-1');
      expect(storesRepo.remove).toHaveBeenCalledWith('s-1');
      expect(auditUseCase.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STORE_DELETED',
          entity: 'BoStore',
          entityId: '001',
          userId: 'adminUser',
        }),
      );
    });
  });

  describe('testConnection', () => {
    it('debe probar la conexión y registrar evento STORE_CONNECTION_TEST', async () => {
      const result = await useCase.testConnection({ ip: '192.168.1.10', dbPort: 5432 }, 'adminUser');

      expect(storesRepo.testConnection).toHaveBeenCalledWith({ ip: '192.168.1.10', dbPort: 5432 });
      expect(auditUseCase.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STORE_CONNECTION_TEST',
          entity: 'BoStore',
          userId: 'adminUser',
        }),
      );
      expect(result).toEqual({ success: true, message: 'OK' });
    });
  });
});
