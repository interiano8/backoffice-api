import { Reflector } from '@nestjs/core';
import { StoresController } from './stores.controller';
import { ROLES_KEY } from '../auth/roles.guard';
import type { IStoresUseCase } from './domain/ports/in/stores.use-case.port';
import type { StoreHealthService } from './store-health.service';

describe('StoresController', () => {
  let controller: StoresController;
  let storesUseCase: jest.Mocked<IStoresUseCase>;
  let storeHealthService: jest.Mocked<StoreHealthService>;
  const reflector = new Reflector();

  const mockStore = {
    id: 's-1',
    code: '001',
    name: 'Estación Central',
    hasDbPassword: true,
  };

  beforeEach(() => {
    storesUseCase = {
      findAll: jest.fn().mockResolvedValue([mockStore]),
      findAllBasic: jest.fn().mockResolvedValue([mockStore]),
      findOne: jest.fn().mockResolvedValue(mockStore),
      create: jest.fn().mockResolvedValue(mockStore),
      update: jest.fn().mockResolvedValue(mockStore),
      remove: jest.fn().mockResolvedValue(undefined),
      testConnection: jest.fn().mockResolvedValue({ success: true, message: 'OK' }),
    };

    storeHealthService = {
      checkAllStoresHealth: jest.fn().mockResolvedValue([]),
      getHealthSummary: jest.fn().mockResolvedValue({ totalStores: 1, online: 1, offline: 0 }),
      checkStoreHealth: jest.fn().mockResolvedValue({
        id: 's-1',
        code: '001',
        name: 'Estación Central',
        healthStatus: 'ONLINE',
      } as any),
    } as any;

    controller = new StoresController(storesUseCase, storeHealthService);
  });

  describe('RBAC Roles Metadata', () => {
    it('debe tener el decorador @Roles(ADMIN, SUPER_ADMIN) en create', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.create);
      expect(roles).toEqual(['ADMIN', 'SUPER_ADMIN']);
    });

    it('debe tener el decorador @Roles(ADMIN, SUPER_ADMIN) en update', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.update);
      expect(roles).toEqual(['ADMIN', 'SUPER_ADMIN']);
    });

    it('debe tener el decorador @Roles(ADMIN, SUPER_ADMIN) en remove', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.remove);
      expect(roles).toEqual(['ADMIN', 'SUPER_ADMIN']);
    });

    it('debe tener el decorador @Roles(ADMIN, SUPER_ADMIN) en testConnection', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.testConnection);
      expect(roles).toEqual(['ADMIN', 'SUPER_ADMIN']);
    });

    it('debe tener el decorador @Roles(ADMIN, SUPER_ADMIN) en pingStore', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.pingStore);
      expect(roles).toEqual(['ADMIN', 'SUPER_ADMIN']);
    });
  });

  describe('Métodos del Controlador', () => {
    const mockRequest = { user: { username: 'admin1', role: 'ADMIN' } };

    it('create debe delegar a storesUseCase pasando el userId del request', async () => {
      const dto = { code: '001', name: 'Estación Central' };
      const res = await controller.create(dto, mockRequest);

      expect(storesUseCase.create).toHaveBeenCalledWith(dto, 'admin1');
      expect(res).toEqual(mockStore);
    });

    it('update debe delegar a storesUseCase pasando el userId del request', async () => {
      const dto = { name: 'Estación Modificada' };
      const res = await controller.update('s-1', dto, mockRequest);

      expect(storesUseCase.update).toHaveBeenCalledWith('s-1', dto, 'admin1');
      expect(res).toEqual(mockStore);
    });

    it('remove debe delegar a storesUseCase pasando el userId del request', async () => {
      await controller.remove('s-1', mockRequest);

      expect(storesUseCase.remove).toHaveBeenCalledWith('s-1', 'admin1');
    });

    it('testConnection debe delegar a storesUseCase pasando el userId del request', async () => {
      const config = { ip: '10.0.0.1', dbPort: 5432 };
      const res = await controller.testConnection(config, mockRequest);

      expect(storesUseCase.testConnection).toHaveBeenCalledWith(config, 'admin1');
      expect(res).toEqual({ success: true, message: 'OK' });
    });

    it('findAll no debe requerir rol administrativo y retornar las tiendas', async () => {
      const res = await controller.findAll();
      expect(storesUseCase.findAll).toHaveBeenCalled();
      expect(res).toEqual([mockStore]);
    });
  });
});
