import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  let service: RbacService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      permission: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      role: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      rolePermission: {
        upsert: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      userRole: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
    };

    service = new RbacService(prismaMock);
  });

  describe('getUserRolesAndPermissions', () => {
    it('retorna los roles y la unión de permisos sin duplicados', async () => {
      prismaMock.userRole.findMany.mockResolvedValueOnce([
        {
          role: {
            id: 'CAJERO',
            isActive: true,
            permissions: [
              { permissionId: 'sales:create' },
              { permissionId: 'sales:reprint' },
            ],
          },
        },
        {
          role: {
            id: 'SUPERVISOR',
            isActive: true,
            permissions: [
              { permissionId: 'sales:create' }, // Duplicado intencional
              { permissionId: 'sales:cancel' },
              { permissionId: 'shifts:close' },
            ],
          },
        },
      ]);

      const result = await service.getUserRolesAndPermissions('user-123');

      expect(result.roles).toEqual(['CAJERO', 'SUPERVISOR']);
      expect(result.permissions.sort()).toEqual([
        'sales:cancel',
        'sales:create',
        'sales:reprint',
        'shifts:close',
      ]);
    });
  });

  describe('deleteCustomRole', () => {
    it('rechaza la eliminación si el rol pertenece al sistema', async () => {
      prismaMock.role.findUnique.mockResolvedValueOnce({
        id: 'ADMIN',
        name: 'Administrador',
        isSystem: true,
      });

      await expect(service.deleteCustomRole('ADMIN')).rejects.toThrow(BadRequestException);
    });

    it('permite eliminar un rol personalizado no perteneciente al sistema', async () => {
      prismaMock.role.findUnique.mockResolvedValueOnce({
        id: 'CUSTOM_AUDITOR',
        name: 'Auditor Externo',
        isSystem: false,
      });

      const result = await service.deleteCustomRole('CUSTOM_AUDITOR');
      expect(result.success).toBe(true);
      expect(prismaMock.role.delete).toHaveBeenCalledWith({ where: { id: 'CUSTOM_AUDITOR' } });
    });
  });

  describe('assignRolesToUser', () => {
    it('asigna múltiples roles y actualiza el rol primario en User', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'u1', username: 'carlos' });
      prismaMock.role.findMany.mockResolvedValueOnce([
        { id: 'CAJERO' },
        { id: 'SUPERVISOR' },
      ]);
      jest.spyOn(service, 'getUserRolesAndPermissions').mockResolvedValueOnce({
        roles: ['CAJERO', 'SUPERVISOR'],
        permissions: ['sales:create', 'shifts:close'],
      });

      const result = await service.assignRolesToUser('u1', ['CAJERO', 'SUPERVISOR']);

      expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prismaMock.userRole.create).toHaveBeenCalledTimes(2);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { role: 'CAJERO' },
      });
      expect(result.roles).toContain('CAJERO');
      expect(result.roles).toContain('SUPERVISOR');
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.assignRolesToUser('u-unknown', ['CAJERO'])).rejects.toThrow(NotFoundException);
    });
  });
});
