import { Injectable, Logger, Inject } from '@nestjs/common';
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

@Injectable()
export class UsersUseCase implements IUsersUseCase {
  private readonly logger = new Logger(UsersUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  async findAll(): Promise<UserEntity[]> {
    return this.userRepo.findAll();
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
    if (!data.username || !data.password || !data.name) {
      throw new ValidationException('Username, password, and name are required.');
    }
    return this.userRepo.create(data);
  }

  async update(id: string, data: UpdateUserData): Promise<UserEntity> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      throw new EntityNotFoundException('User', id);
    }
    return this.userRepo.update(id, data);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      throw new EntityNotFoundException('User', id);
    }
    await this.userRepo.remove(id);
  }
}
