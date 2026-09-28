import { Injectable, Logger, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import { encryptPin } from '../../common/utils/pin-crypto';
import type { IConnectionFactory } from '../../common/connections/connection-factory.interface';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  UserRepository,
  UserEntity,
  UserAuthEntity,
} from '../domain/ports/user-repository.interface';

@Injectable()
export class TpvUserRepository implements UserRepository {
  private readonly logger = new Logger(TpvUserRepository.name);
  private readonly fullSelect =
    'SELECT id as "Id", usuario as "Usuario", nombre as "Nombre", pin as "PIN", perfil as "Perfil", esta_activo as "Is_active", codigo_rfid as "Codigo_RFID", hash_contrasena as "PasswordHash" FROM empleados';

  constructor(
    @Inject('IConnectionFactory')
    private readonly connectionFactory: IConnectionFactory,
    private readonly prisma: PrismaService,
  ) {}

  private async getPool(): Promise<any> {
    return this.connectionFactory.getTpvConnection('DEFAULT');
  }

  async findAll(): Promise<UserEntity[]> {
    let pool: any = null;
    try {
      pool = await this.getPool();
      const res = await pool.query(this.fullSelect);
      const tpvUsers = (res.recordset || []).map((emp: any) => this.mapToEntity(emp));
      const localUsers = await this.prisma.user.findMany({
        include: {
          userRoles: {
            select: { roleId: true },
          },
        },
      });
      const localEntities: UserEntity[] = localUsers.map((u) => {
        const userRoles = u.userRoles?.map((ur) => ur.roleId) || [];
        return {
          id: u.id,
          username: u.username,
          name: u.name,
          email: u.email || undefined,
          role: u.role,
          roles: userRoles.length > 0 ? userRoles : [u.role],
          isActive: u.isActive,
        };
      });
      return [...localEntities, ...tpvUsers];
    } catch (error: any) {
      this.logger.error(`Error listing users: ${error.message}`);
      const localUsers = await this.prisma.user.findMany({
        include: {
          userRoles: {
            select: { roleId: true },
          },
        },
      });
      return localUsers.map((u) => {
        const userRoles = u.userRoles?.map((ur) => ur.roleId) || [];
        return {
          id: u.id,
          username: u.username,
          name: u.name,
          email: u.email || undefined,
          role: u.role,
          roles: userRoles.length > 0 ? userRoles : [u.role],
          isActive: u.isActive,
        };
      });
    } finally {
      if (pool) await pool.close();
    }
  }

  async findById(id: string): Promise<UserEntity | null> {
    const cleanId = id?.trim() || '';
    const local = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { username: { equals: cleanId, mode: 'insensitive' } },
        ],
      },
    });
    if (local) {
      return {
        id: local.id,
        username: local.username,
        name: local.name,
        email: local.email || undefined,
        role: local.role,
        isActive: local.isActive,
      };
    }

    let pool: any = null;
    try {
      pool = await this.getPool();
      const res = await pool.queryParams(
        `${this.fullSelect} WHERE CAST(id AS TEXT) = @id OR TRIM(usuario) ILIKE TRIM(@id)`,
        { id: cleanId },
      );
      if (res.recordset?.length > 0) {
        return this.mapToEntity(res.recordset[0]);
      }
      return null;
    } catch (error: any) {
      this.logger.error(`Error finding user by id: ${error.message}`);
      return null;
    } finally {
      if (pool) await pool.close();
    }
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    const cleanUsername = username?.trim() || '';
    if (!cleanUsername) return null;

    const local = await this.prisma.user.findFirst({
      where: { username: { equals: cleanUsername, mode: 'insensitive' } },
    });
    if (local) {
      return {
        id: local.id,
        username: local.username,
        name: local.name,
        email: local.email || undefined,
        role: local.role,
        isActive: local.isActive,
      };
    }

    let pool: any = null;
    try {
      pool = await this.getPool();
      const res = await pool.queryParams(
        `${this.fullSelect} WHERE TRIM(usuario) ILIKE TRIM(@username)`,
        { username: cleanUsername },
      );
      if (res.recordset?.length > 0) {
        return this.mapToEntity(res.recordset[0]);
      }
      return null;
    } catch (error: any) {
      this.logger.error(`Error finding user by username: ${error.message}`);
      return null;
    } finally {
      if (pool) await pool.close();
    }
  }

  async findByUsernameWithPassword(username: string): Promise<UserAuthEntity | null> {
    const cleanUsername = username?.trim() || '';
    if (!cleanUsername) return null;

    const local = await this.prisma.user.findFirst({
      where: { username: { equals: cleanUsername, mode: 'insensitive' } },
    });
    if (local) {
      return {
        id: local.id,
        username: local.username,
        name: local.name,
        email: local.email || undefined,
        role: local.role,
        isActive: local.isActive,
        password: local.password,
      };
    }

    let pool: any = null;
    try {
      pool = await this.getPool();
      const res = await pool.queryParams(
        `${this.fullSelect} WHERE TRIM(usuario) ILIKE TRIM(@username)`,
        { username: cleanUsername },
      );
      if (res.recordset?.length > 0) {
        const emp = res.recordset[0];
        return {
          ...this.mapToEntity(emp),
          password: emp.PasswordHash || '',
        };
      }
      return null;
    } catch (error: any) {
      this.logger.error(`Error finding user with password: ${error.message}`);
      return null;
    } finally {
      if (pool) await pool.close();
    }
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const cleanEmail = email?.trim() || '';
    if (!cleanEmail) return null;

    const local = await this.prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: 'insensitive' } },
    });
    if (local) {
      return {
        id: local.id,
        username: local.username,
        name: local.name,
        email: local.email || undefined,
        role: local.role,
        isActive: local.isActive,
      };
    }
    return null;
  }

  async create(data: any): Promise<UserEntity> {
    let pool: any = null;
    try {
      pool = await this.getPool();
      const username = data.username?.trim() || '';
      const name = data.name?.trim() || data.username?.trim() || '';
      const pin = data.pin?.trim() || '';
      const role = data.role || 'Admin';
      const isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;
      const codigoRfid = data.codigoRfid?.trim() || null;
      const passwordHash = data.password
        ? crypto.createHash('sha256').update(data.password).digest('hex')
        : '';
      const encryptedPin = pin ? encryptPin(pin) : null;
      const email = data.email?.trim() || null;

      const exists = await pool.queryParams(
        'SELECT COUNT(*) AS cnt FROM empleados WHERE TRIM(usuario) ILIKE TRIM(@username)',
        { username },
      );
      if (Number(exists.recordset?.[0]?.cnt) > 0) {
        throw new Error(`El usuario "${username}" ya existe`);
      }

      const res = await pool.queryParams(
        `INSERT INTO empleados (usuario, nombre, pin, perfil, esta_activo, codigo_rfid, hash_contrasena)
         VALUES (@username, @name, @pin, @role, @isActive, @codigoRfid, @passwordHash)
         RETURNING id AS "NewId"`,
        { username, name, pin: encryptedPin, role, isActive, codigoRfid, passwordHash },
      );

      const newId = res.recordset?.[0]?.NewId;

      if (this.prisma?.user) {
        try {
          await this.prisma.user.upsert({
            where: { username },
            update: { name, email, role, isActive },
            create: { username, name, email, password: passwordHash, role, isActive },
          });
        } catch (e: any) {
          this.logger.warn(`Could not sync user to prisma.user: ${e.message}`);
        }
      }

      return {
        id: String(newId || username),
        username,
        name,
        email: email || undefined,
        role,
        isActive,
        pin: pin || undefined,
        codigoRfid: codigoRfid || undefined,
      };
    } catch (error: any) {
      this.logger.error(`Error creating user in empleados: ${error.message}`);
      throw error;
    } finally {
      if (pool) await pool.close();
    }
  }

  async update(id: string, data: any): Promise<UserEntity> {
    let pool: any = null;
    try {
      pool = await this.getPool();

      const setClauses: string[] = [];
      const params: Record<string, any> = { id: id?.trim() || '' };

      if (data.username !== undefined) {
        setClauses.push('usuario = @username');
        params.username = data.username?.trim() || '';
      }
      if (data.name !== undefined) {
        setClauses.push('nombre = @name');
        params.name = data.name?.trim() || '';
      }
      if (data.pin !== undefined) {
        setClauses.push('pin = @pin');
        const rawPin = data.pin?.trim() || '';
        params.pin = rawPin ? encryptPin(rawPin) : null;
      }
      if (data.role !== undefined) {
        setClauses.push('perfil = @role');
        params.role = data.role;
      }
      if (data.isActive !== undefined) {
        setClauses.push('esta_activo = @isActive');
        params.isActive = Boolean(data.isActive);
      }
      if (data.codigoRfid !== undefined) {
        setClauses.push('codigo_rfid = @codigoRfid');
        params.codigoRfid = data.codigoRfid?.trim() || null;
      }
      if (data.password !== undefined && data.password !== '') {
        setClauses.push('hash_contrasena = @passwordHash');
        params.passwordHash = data.password.startsWith('$scrypt$')
          ? data.password
          : crypto.createHash('sha256').update(data.password).digest('hex');
      }

      if (data.email !== undefined && this.prisma?.user) {
        try {
          const userRecord = await this.prisma.user.findFirst({
            where: {
              OR: [
                { id: id?.trim() || '' },
                { username: { equals: id?.trim() || '', mode: 'insensitive' } },
              ],
            },
          });
          if (userRecord) {
            await this.prisma.user.update({
              where: { id: userRecord.id },
              data: { email: data.email?.trim() || null },
            });
          }
        } catch (e: any) {
          this.logger.warn(`Could not sync email to prisma.user: ${e.message}`);
        }
      }

      if (setClauses.length === 0) {
        const current = await this.findById(id);
        if (!current) throw new Error('Usuario no encontrado');
        return current;
      }

      await pool.queryParams(
        `UPDATE empleados SET ${setClauses.join(', ')} WHERE CAST(id AS TEXT) = @id OR TRIM(usuario) ILIKE TRIM(@id)`,
        params,
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error('Usuario no encontrado tras actualizar');
      }
      return updated;
    } catch (error: any) {
      this.logger.error(`Error updating user in empleados: ${error.message}`);
      throw new Error(`Error al actualizar usuario: ${error.message}`);
    } finally {
      if (pool) await pool.close();
    }
  }

  async remove(id: string): Promise<void> {
    let pool: any = null;
    try {
      pool = await this.getPool();
      const cleanId = id?.trim() || '';
      await pool.queryParams(
        'DELETE FROM empleados WHERE CAST(id AS TEXT) = @id OR TRIM(usuario) ILIKE TRIM(@id)',
        { id: cleanId },
      );
    } catch (error: any) {
      this.logger.error(`Error removing user from empleados: ${error.message}`);
      throw new Error(`Error al eliminar usuario: ${error.message}`);
    } finally {
      if (pool) await pool.close();
    }
  }

  private mapToEntity(emp: any): UserEntity {
    return {
      id: String(emp.Id || emp.Usuario),
      username: emp.Usuario || '',
      name: emp.Nombre || emp.Usuario || '',
      role: emp.Perfil || 'Admin',
      isActive: emp.Is_active === undefined || emp.Is_active === 1 || emp.Is_active === true,
      pin: emp.PIN || undefined,
      codigoRfid: emp.Codigo_RFID || undefined,
    };
  }
}
