import { RolesController } from './roles.controller';

describe('RolesController', () => {
  let controller: RolesController;
  let rbacServiceMock: any;

  beforeEach(() => {
    rbacServiceMock = {
      listRoles: jest.fn().mockResolvedValue([{ id: 'ADMIN', name: 'Administrador' }]),
      createCustomRole: jest.fn().mockResolvedValue({ id: 'AUDITOR_EXT', name: 'Auditor Externo' }),
      updateCustomRole: jest.fn().mockResolvedValue({ id: 'AUDITOR_EXT', name: 'Auditor Modificado' }),
      deleteCustomRole: jest.fn().mockResolvedValue({ success: true }),
      listPermissions: jest.fn().mockResolvedValue([{ id: 'sales:create', name: 'Emitir' }]),
      assignRolesToUser: jest.fn().mockResolvedValue({ roles: ['CAJERO', 'SUPERVISOR'], permissions: [] }),
      getUserRolesAndPermissions: jest.fn().mockResolvedValue({ roles: ['CAJERO'], permissions: ['sales:create'] }),
    };

    controller = new RolesController(rbacServiceMock);
  });

  it('lista roles delegando al servicio', async () => {
    const res = await controller.listRoles();
    expect(rbacServiceMock.listRoles).toHaveBeenCalled();
    expect(res).toEqual([{ id: 'ADMIN', name: 'Administrador' }]);
  });

  it('crea un rol personalizado delegando al servicio', async () => {
    const body = { id: 'AUDITOR_EXT', name: 'Auditor Externo', permissionIds: ['reports:view'] };
    const res = await controller.createRole(body);
    expect(rbacServiceMock.createCustomRole).toHaveBeenCalledWith(body);
    expect(res.id).toBe('AUDITOR_EXT');
  });

  it('actualiza un rol personalizado delegando al servicio', async () => {
    const body = { name: 'Auditor Modificado' };
    const res = await controller.updateRole('AUDITOR_EXT', body);
    expect(rbacServiceMock.updateCustomRole).toHaveBeenCalledWith('AUDITOR_EXT', body);
    expect(res.name).toBe('Auditor Modificado');
  });

  it('elimina un rol delegando al servicio', async () => {
    const res = await controller.deleteRole('AUDITOR_EXT');
    expect(rbacServiceMock.deleteCustomRole).toHaveBeenCalledWith('AUDITOR_EXT');
    expect(res.success).toBe(true);
  });

  it('lista permisos delegando al servicio', async () => {
    const res = await controller.listPermissions();
    expect(rbacServiceMock.listPermissions).toHaveBeenCalled();
    expect(res).toHaveLength(1);
  });

  it('asigna roles a un usuario delegando al servicio', async () => {
    const res = await controller.assignRoles('user-1', { roleIds: ['CAJERO', 'SUPERVISOR'] });
    expect(rbacServiceMock.assignRolesToUser).toHaveBeenCalledWith('user-1', ['CAJERO', 'SUPERVISOR']);
    expect(res.roles).toEqual(['CAJERO', 'SUPERVISOR']);
  });

  it('consulta roles y permisos de un usuario delegando al servicio', async () => {
    const res = await controller.getUserRoles('user-1');
    expect(rbacServiceMock.getUserRolesAndPermissions).toHaveBeenCalledWith('user-1');
    expect(res.roles).toEqual(['CAJERO']);
  });
});
