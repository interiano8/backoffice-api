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
      findByUsername: jest.fn().mockResolvedValue(mockUser),
      findByUsernameWithPassword: jest.fn().mockResolvedValue(null),
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

  it('should create a valid user', async () => {
    const createData = { username: 'newuser', password: 'password123', name: 'New User' };
    const result = await useCase.create(createData);
    expect(mockRepo.create).toHaveBeenCalledWith(createData);
    expect(result).toEqual(mockUser);
  });

  it('should throw ValidationException on missing required fields', async () => {
    await expect(useCase.create({ username: '', password: '', name: '' })).rejects.toThrow(ValidationException);
  });

  it('should update user and throw if not found', async () => {
    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(useCase.update('non-existent', { name: 'Updated' })).rejects.toThrow(EntityNotFoundException);
  });

  it('should delete user and throw if not found', async () => {
    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(useCase.remove('non-existent')).rejects.toThrow(EntityNotFoundException);
  });
});
