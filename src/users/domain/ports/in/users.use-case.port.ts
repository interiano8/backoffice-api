import type { UserEntity, UserAuthEntity } from '../user-repository.interface';

export interface CreateUserData {
  username: string;
  password: string;
  name: string;
  email: string;
  role?: string;
  pin?: string;
  codigoRfid?: string;
}

export interface UpdateUserData {
  username?: string;
  password?: string;
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  pin?: string;
  codigoRfid?: string;
}

export interface IUsersUseCase {
  findAll(): Promise<UserEntity[]>;
  findById(id: string): Promise<UserEntity | null>;
  findByUsername(username: string): Promise<UserEntity | null>;
  findByUsernameWithPassword(username: string): Promise<UserAuthEntity | null>;
  create(data: CreateUserData): Promise<UserEntity>;
  update(id: string, data: UpdateUserData): Promise<UserEntity>;
  remove(id: string): Promise<void>;
}
