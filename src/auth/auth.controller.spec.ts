import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { USERS_USE_CASE } from '../users/users.tokens';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: () => 'token', verify: () => ({}) } },
        { provide: 'AuthRepository', useValue: { findStoreByCode: () => null, findStoreById: () => null, findEmployee: () => null } },
        { provide: 'EmployeeRepository', useValue: { findEmployee: () => null } },
        { provide: 'PasswordVerifier', useValue: { verify: () => Promise.resolve(true) } },
        { provide: 'IAuditUseCase', useValue: { record: () => Promise.resolve() } },
        { provide: USERS_USE_CASE, useValue: { findByUsernameWithPassword: () => null, findByUsername: () => null } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
