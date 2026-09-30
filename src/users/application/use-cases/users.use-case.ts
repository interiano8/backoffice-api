import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import type {
  IUsersUseCase,
  CreateUserData,
  UpdateUserData,
} from '../../domain/ports/in/users.use-case.port';
import type {
  UserRepository,
  UserEntity,
  UserAuthEntity,
} from '../../domain/ports/user-repository.interface';
import { USER_REPOSITORY } from '../../users.tokens';
import { EntityNotFoundException, ValidationException } from '../../../common/domain/exceptions/domain.exception';
import { SyncService } from '../../../sync/sync.service';

@Injectable()
export class UsersUseCase implements IUsersUseCase {
  private readonly logger = new Logger(UsersUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Optional() private readonly syncService?: SyncService,
  ) {}

  async findAll(storeCode?: string): Promise<UserEntity[]> {
    return this.userRepo.findAll(storeCode);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new EntityNotFoundException('User', id);
    }
    return user;
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.userRepo.findByUsername(username);
  }

  async findByUsernameWithPassword(
    username: string,
  ): Promise<UserAuthEntity | null> {
    return this.userRepo.findByUsernameWithPassword(username);
  }

  async create(data: CreateUserData): Promise<UserEntity> {
    const username = data.username?.trim();
    const name = data.name?.trim();
    const email = data.email?.trim();
    const password = data.password;

    if (!username || !password || !name) {
      throw new ValidationException('Username, password, and name are required.');
    }
    if (!email) {
      throw new ValidationException('Email is required.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationException('Invalid email format.');
    }

    const existingUser = await this.userRepo.findByUsername(username);
    if (existingUser) {
      throw new ValidationException(`Username "${username}" already exists.`);
    }

    const existingEmail = await this.userRepo.findByEmail(email);
    if (existingEmail) {
      throw new ValidationException(`Email "${email}" is already in use.`);
    }

    const created = await this.userRepo.create({
      ...data,
      username,
      name,
      email,
    });
    this.syncService?.bumpMasterVersion();
    return created;
  }

  async update(id: string, data: UpdateUserData): Promise<UserEntity> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      throw new EntityNotFoundException('User', id);
    }

    if (data.email !== undefined) {
      const email = data.email?.trim();
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new ValidationException('Invalid email format.');
        }
        const duplicateEmail = await this.userRepo.findByEmail(email);
        if (duplicateEmail && duplicateEmail.id !== id) {
          throw new ValidationException(`Email "${email}" is already in use.`);
        }
      }
    }

    if (data.username !== undefined) {
      const username = data.username?.trim();
      if (username) {
        const duplicateUser = await this.userRepo.findByUsername(username);
        if (duplicateUser && duplicateUser.id !== id) {
          throw new ValidationException(`Username "${username}" already exists.`);
        }
      }
    }

    const updated = await this.userRepo.update(id, data);
    this.syncService?.bumpMasterVersion();
    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      throw new EntityNotFoundException('User', id);
    }
    await this.userRepo.remove(id);
    this.syncService?.bumpMasterVersion();
  }
}
