export interface UserEntity {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: string;
  roles?: string[];
  isActive: boolean;
  pin?: string;
  codigoRfid?: string;
}

export interface UserAuthEntity extends UserEntity {
  password: string;
}

export interface UserRepository {
  findAll(storeCode?: string): Promise<UserEntity[]>;
  findById(id: string): Promise<UserEntity | null>;
  findByUsername(username: string): Promise<UserEntity | null>;
  findByUsernameWithPassword(username: string): Promise<UserAuthEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  create(data: any): Promise<UserEntity>;
  update(id: string, data: any): Promise<UserEntity>;
  remove(id: string): Promise<void>;
}
