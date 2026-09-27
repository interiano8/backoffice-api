import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository';
import { TpvEmployeeRepository } from './infrastructure/tpv-employee.repository';
import { Pbkdf2PasswordVerifier } from './domain/services/password-verifier.service';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { RolesGuard } from './roles.guard';
import { RbacService } from './rbac/rbac.service';
import { PermissionsGuard } from './rbac/permissions.guard';

const jwtSecret = process.env.JWT_SECRET;
const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production' && !jwtSecret) {
  throw new Error('JWT_SECRET environment variable is REQUIRED in production.');
}

if (!jwtSecret && nodeEnv !== 'production') {
  process.stderr.write(
    'WARNING: JWT_SECRET not set. Using insecure default for development.\n',
  );
}

import { RolesController } from './rbac/roles.controller';

@Module({
  imports: [
    PassportModule,
    forwardRef(() => AuditModule),
    UsersModule,
    JwtModule.register({
      secret: jwtSecret || 'SECRET_KEY_DEV_CHANGE_ME_INSECURE',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    RbacService,
    PermissionsGuard,
    { provide: 'AuthRepository', useClass: PrismaAuthRepository },
    { provide: 'EmployeeRepository', useClass: TpvEmployeeRepository },
    { provide: 'PasswordVerifier', useClass: Pbkdf2PasswordVerifier },
    { provide: APP_GUARD, useClass: RolesGuard },
    RolesGuard,
  ],
  controllers: [AuthController, RolesController],
  exports: [AuthService, RolesGuard, RbacService, PermissionsGuard],
})
export class AuthModule {}
