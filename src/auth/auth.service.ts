import { Injectable, Logger, Inject, UnauthorizedException, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { IAuditUseCase } from '../audit/domain/ports/in/audit.use-case.port';
import { AUDIT_USE_CASE } from '../audit/audit.tokens';
import type { AuthRepository } from './domain/ports/auth-repository.interface';
import type { EmployeeRepository } from './domain/ports/employee-repository.interface';
import type { PasswordVerifier } from './domain/ports/password-verifier.interface';
import { USERS_USE_CASE } from '../users/users.tokens';
import type { IUsersUseCase } from '../users/domain/ports/in/users.use-case.port';
import { RbacService } from './rbac/rbac.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    @Inject('AuthRepository') private readonly authRepo: AuthRepository,
    @Inject('EmployeeRepository') private readonly employeeRepo: EmployeeRepository,
    @Inject('PasswordVerifier') private readonly passwordVerifier: PasswordVerifier,
    @Inject(AUDIT_USE_CASE) private auditUseCase: IAuditUseCase,
    @Inject(USERS_USE_CASE) private readonly usersUseCase: IUsersUseCase,
    @Optional() private readonly rbacService?: RbacService,
  ) {}

  async validateUser(username: string, pass: string, storeId?: string) {
    this.logger.log(`Validating user ${username}`);

    let storeCode: string | undefined;
    if (storeId) {
      const store = await this.authRepo.findStoreById(storeId);
      if (!store) throw new UnauthorizedException('Tienda no encontrada');
      storeCode = store.code;
    }

    const localUser = await this.usersUseCase.findByUsernameWithPassword(username);
    if (localUser) {
      if (!localUser.isActive) {
        this.logger.warn(`Local user '${username}' is inactive`);
        throw new UnauthorizedException('Usuario desactivado. Contacte al administrador.');
      }
      if (localUser.role === 'Bombero') {
        this.logger.warn(`Local user '${username}' is Bombero`);
        throw new UnauthorizedException('No tienes permisos para acceder al BackOffice.');
      }
      const isValid = await this.passwordVerifier.verify(pass, localUser.password);
      if (!isValid) {
        this.logger.warn(`Local user '${username}': incorrect password`);
        await this.auditUseCase.record({ action: 'LOGIN_FAILED', entity: 'Auth', entityId: username });
        throw new UnauthorizedException('Contraseña incorrecta.');
      }
      await this.auditUseCase.record({ action: 'LOGIN_SUCCESS', entity: 'Auth', entityId: username, userId: username });
      return {
        Id: localUser.id,
        Usuario: localUser.username,
        Nombre: localUser.name,
        Perfil: localUser.role,
        PasswordHash: undefined,
      };
    }

    const user = await this.employeeRepo.findEmployee(username, storeCode);
    if (!user) {
      await this.auditUseCase.record({ action: 'LOGIN_FAILED', entity: 'Auth', entityId: username });
      throw new UnauthorizedException('Usuario no encontrado o desactivado.');
    }

    if (user.Perfil === 'Bombero') {
      this.logger.warn(`TPV employee '${username}' is Bombero`);
      throw new UnauthorizedException('No tienes permisos para acceder al BackOffice.');
    }

    const isValid = await this.passwordVerifier.verify(pass, user.PasswordHash);
    if (!isValid) {
      await this.auditUseCase.record({ action: 'LOGIN_FAILED', entity: 'Auth', entityId: username });
      throw new UnauthorizedException('Contraseña incorrecta.');
    }

    const { PasswordHash: _hash, ...result } = user;
    await this.auditUseCase.record({ action: 'LOGIN_SUCCESS', entity: 'Auth', entityId: username, userId: username });
    return result;
  }

  async login(user: any) {
    let roles: string[] = [];
    let permissions: string[] = [];

    if (this.rbacService && user.Id) {
      try {
        const rbacInfo = await this.rbacService.getUserRolesAndPermissions(String(user.Id));
        roles = rbacInfo.roles;
        permissions = rbacInfo.permissions;
      } catch (err: any) {
        this.logger.debug(`No se pudieron resolver permisos RBAC para ${user.Id}: ${err.message}`);
      }
    }

    if (roles.length === 0) {
      roles = [user.Perfil || 'OPERATOR'];
    }

    const payload = {
      username: user.Usuario,
      sub: user.Id,
      role: roles[0] || user.Perfil || 'Admin',
      roles,
      permissions,
      name: user.Nombre || user.Usuario,
      usuario: user.Usuario,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: payload,
    };
  }
}
