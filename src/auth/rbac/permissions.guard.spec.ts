import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from './require-permissions.decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('permite acceso si no hay permisos requeridos en la ruta', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const context = createMockContext({ id: '1', role: 'OPERATOR' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite acceso irrestricto si el rol es ADMIN o SUPER_ADMIN', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['prices:schedule', 'stores:manage']);
    const context = createMockContext({ id: '1', roles: ['ADMIN'] });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite acceso si el usuario posee todos los permisos requeridos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['sales:create', 'sales:reprint']);
    const context = createMockContext({
      id: '2',
      roles: ['CAJERO'],
      permissions: ['sales:create', 'sales:reprint', 'discounts:apply'],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('lanza ForbiddenException si falta algún permiso requerido', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['prices:schedule', 'stores:manage']);
    const context = createMockContext({
      id: '3',
      roles: ['OPERATOR'],
      permissions: ['reports:view'],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lanza ForbiddenException si el usuario no está en el request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['sales:create']);
    const context = createMockContext(null);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
