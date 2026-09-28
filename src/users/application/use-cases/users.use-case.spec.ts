import { UsersUseCase } from './users.use-case';
import type { UserRepository, UserEntity } from '../../domain/ports/user-repository.interface';
import { EntityNotFoundException, ValidationException } from '../../../common/domain/exceptions/domain.exception';

describe('UsersUseCase', () => {
  let useCase: UsersUseCase;
  let mockRepo: jest.Mocked<UserRepository>;

  const mockUser: UserEntity = {
    id: 'u-1',
    username: 'admin',
    name: 'Administrator',
    email: 'admin@bcpos.space',
    role: 'ADMIN',
    isActive: true,
  };

  beforeEach(() => {
    mockRepo = {
      findAll: jest.fn().mockResolvedValue([mockUser]),
      findById: jest.fn().mockResolvedValue(mockUser),
      findByUsername: jest.fn().mockResolvedValue(null),
      findByUsernameWithPassword: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue(mockUser),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new UsersUseCase(mockRepo);
  });

  it('should list all users', async () => {
    const result = await useCase.findAll();
    expect(mockRepo.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('should find user by id', async () => {
    const result = await useCase.findById('u-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('u-1');
    expect(result).toEqual(mockUser);
  });

  it('should throw EntityNotFoundException when user id not found', async () => {
    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(useCase.findById('non-existent')).rejects.toThrow(EntityNotFoundException);
  });

  it('should create a valid user with email', async () => {
    const createData = {
      username: 'newuser',
      password: 'password123',
      name: 'New User',
      email: 'newuser@bcpos.space',
    };
    const result = await useCase.create(createData);
    expect(mockRepo.create).toHaveBeenCalledWith(createData);
    expect(result).toEqual(mockUser);
  });

  it('should throw ValidationException on missing required fields', async () => {
    await expect(
      useCase.create({ username: '', password: '', name: '', email: 'a@b.com' }),
    ).rejects.toThrow(ValidationException);
  });

  it('should throw ValidationException when email is missing or empty', async () => {
    await expect(
      useCase.create({ username: 'user', password: 'pwd', name: 'User', email: '' }),
    ).rejects.toThrow('Email is required.');
  });

  it('should throw ValidationException on invalid email format', async () => {
    await expect(
      useCase.create({ username: 'user', password: 'pwd', name: 'User', email: 'invalid-email' }),
    ).rejects.toThrow('Invalid email format.');
  });

  it('should throw ValidationException when username already exists case-insensitively', async () => {
    mockRepo.findByUsername.mockResolvedValueOnce(mockUser);
    await expect(
      useCase.create({ username: 'ADMIN', password: 'pwd', name: 'User', email: 'admin2@bcpos.space' }),
    ).rejects.toThrow('Username "ADMIN" already exists.');
  });

  it('should throw ValidationException when email already exists', async () => {
    mockRepo.findByEmail.mockResolvedValueOnce(mockUser);
    await expect(
      useCase.create({ username: 'otheruser', password: 'pwd', name: 'User', email: 'admin@bcpos.space' }),
    ).rejects.toThrow('Email "admin@bcpos.space" is already in use.');
  });

  it('should update user and throw if not found', async () => {
    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(useCase.update('non-existent', { name: 'Updated' })).rejects.toThrow(EntityNotFoundException);
  });

  it('should throw ValidationException on update with invalid email format', async () => {
    await expect(
      useCase.update('u-1', { email: 'bad-email' }),
    ).rejects.toThrow('Invalid email format.');
  });

  it('should throw ValidationException on update if email is used by another user', async () => {
    mockRepo.findByEmail.mockResolvedValueOnce({ ...mockUser, id: 'u-2' });
    await expect(
      useCase.update('u-1', { email: 'existing@bcpos.space' }),
    ).rejects.toThrow('Email "existing@bcpos.space" is already in use.');
  });

  it('should allow updating user with their own email', async () => {
    mockRepo.findByEmail.mockResolvedValueOnce(mockUser);
    const result = await useCase.update('u-1', { email: 'admin@bcpos.space' });
    expect(result).toEqual(mockUser);
  });

  it('should delete user and throw if not found', async () => {
    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(useCase.remove('non-existent')).rejects.toThrow(EntityNotFoundException);
  });
});
