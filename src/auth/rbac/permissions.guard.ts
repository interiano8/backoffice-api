import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    let user = request.user;
    if (!user && request.headers?.authorization?.startsWith('Bearer ')) {
      try {
        const token = request.headers.authorization.slice(7);
        const parts = token.split('.');
        if (parts.length >= 2) {
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          user = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
          request.user = user;
        }
      } catch {}
    }

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    // Super Admin y Admin tienen pase irrestricto
    const roles: string[] = Array.isArray(user.roles)
      ? user.roles
      : user.role
        ? [user.role]
        : [];

    if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) {
      return true;
    }

    const userPermissions: string[] = Array.isArray(user.permissions)
      ? user.permissions
      : [];

    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAll) {
      const missing = requiredPermissions.filter(
        (p) => !userPermissions.includes(p),
      );
      throw new ForbiddenException(
        `Acceso denegado. Permisos requeridos faltantes: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
