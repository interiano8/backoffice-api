import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
} from './permissions.catalog';

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedSystemRolesAndPermissions();
    await this.migrateExistingUsers();
  }

  /**
   * Inicializa de forma idempotente los permisos y roles esenciales del sistema.
   */
  async seedSystemRolesAndPermissions() {
    this.logger.log('Inicializando catálogo de permisos y roles del sistema...');

    // 1. Upsert Permisos
    for (const p of SYSTEM_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { id: p.id },
        update: {
          name: p.name,
          module: p.module,
          description: p.description,
        },
        create: {
          id: p.id,
          name: p.name,
          module: p.module,
          description: p.description,
        },
      });
    }

    // 2. Upsert Roles del Sistema
    for (const r of SYSTEM_ROLES) {
      await this.prisma.role.upsert({
        where: { id: r.id },
        update: {
          name: r.name,
          description: r.description,
          isSystem: true,
          isActive: true,
        },
        create: {
          id: r.id,
          name: r.name,
          description: r.description,
          isSystem: true,
          isActive: true,
        },
      });

      // 3. Vincular permisos a roles del sistema
      for (const permId of r.permissions) {
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: r.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: r.id,
            permissionId: permId,
          },
        }).catch(() => {});
      }
    }

    this.logger.log('Catálogo de permisos y roles del sistema inicializado.');
  }

  /**
   * Asocia roles equivalentes a usuarios antiguos que aún no tengan registros en `UserRole`.
   */
  async migrateExistingUsers() {
    const usersWithoutRoles = await this.prisma.user.findMany({
      where: {
        userRoles: { none: {} },
      },
      select: { id: true, role: true, username: true },
    });

    for (const u of usersWithoutRoles) {
      const normalized = (u.role || '').toUpperCase().trim();
      let targetRole = 'ADMIN';

      if (normalized.includes('SUPER')) targetRole = 'SUPER_ADMIN';
      else if (normalized.includes('ADMIN')) targetRole = 'ADMIN';
      else if (normalized.includes('SUPERV')) targetRole = 'SUPERVISOR';
      else if (normalized.includes('CAJ')) targetRole = 'CAJERO';
      else if (normalized.includes('BOMB')) targetRole = 'BOMBERO';
      else if (normalized.includes('AUDIT')) targetRole = 'AUDITOR';

      await this.prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: u.id,
            roleId: targetRole,
          },
        },
        update: {},
        create: {
          userId: u.id,
          roleId: targetRole,
        },
      }).catch(() => {});

      this.logger.log(`Usuario migrado a RBAC: ${u.username} -> ${targetRole}`);
    }
  }

  /**
   * Resuelve los roles y la unión matemática de permisos efectivos de un usuario.
   */
  async getUserRolesAndPermissions(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              select: { permissionId: true },
            },
          },
        },
      },
    });

    const activeRoles = userRoles.filter(ur => ur.role.isActive);
    const roles = activeRoles.map(ur => ur.role.id);

    const permissionSet = new Set<string>();
    for (const ur of activeRoles) {
      for (const p of ur.role.permissions) {
        permissionSet.add(p.permissionId);
      }
    }

    return {
      roles,
      permissions: Array.from(permissionSet),
    };
  }

  /**
   * Asigna múltiples roles a un usuario.
   */
  async assignRolesToUser(userId: string, roleIds: string[]): Promise<{ roles: string[]; permissions: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    // Validar que todos los roles existan
    const existingRoles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });
    if (existingRoles.length !== roleIds.length) {
      throw new BadRequestException('Uno o más roles seleccionados no existen.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Eliminar asignaciones previas
      await tx.userRole.deleteMany({ where: { userId } });

      // Insertar nuevas asignaciones
      for (const roleId of roleIds) {
        await tx.userRole.create({
          data: { userId, roleId },
        });
      }

      // Actualizar columna legacy role para retrocompatibilidad
      const primaryRole = roleIds[0] || 'OPERATOR';
      await tx.user.update({
        where: { id: userId },
        data: { role: primaryRole },
      });
    });

    return this.getUserRolesAndPermissions(userId);
  }

  /**
   * Crea un rol personalizado.
   */
  async createCustomRole(data: { id: string; name: string; description?: string; permissionIds: string[] }) {
    const slug = data.id.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
    const existing = await this.prisma.role.findUnique({ where: { id: slug } });
    if (existing) {
      throw new BadRequestException(`El rol con identificador "${slug}" ya existe.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          id: slug,
          name: data.name,
          description: data.description || null,
          isSystem: false,
          isActive: true,
        },
      });

      for (const permId of data.permissionIds) {
        await tx.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }

      return role;
    });
  }

  /**
   * Actualiza un rol personalizado.
   */
  async updateCustomRole(roleId: string, data: { name?: string; description?: string; permissionIds?: string[]; isActive?: boolean }) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Rol "${roleId}" no encontrado.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id: roleId },
        data: {
          name: data.name ?? role.name,
          description: data.description !== undefined ? data.description : role.description,
          isActive: data.isActive !== undefined ? data.isActive : role.isActive,
        },
      });

      if (data.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        for (const permId of data.permissionIds) {
          await tx.rolePermission.create({
            data: { roleId, permissionId: permId },
          });
        }
      }

      return updated;
    });
  }

  /**
   * Elimina un rol personalizado (impide eliminar roles del sistema).
   */
  async deleteCustomRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Rol "${roleId}" no encontrado.`);
    }
    if (role.isSystem) {
      throw new BadRequestException('Los roles del sistema son inmutables y no pueden eliminarse.');
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    return { success: true, message: `Rol "${roleId}" eliminado exitosamente.` };
  }

  /**
   * Lista todos los roles con sus permisos asignados.
   */
  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          select: { permissionId: true },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Lista el catálogo completo de permisos agrupados.
   */
  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
  }
}
