import { UsersController } from './users.controller';
import type { IUsersUseCase } from './domain/ports/in/users.use-case.port';
import { BadRequestException } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let useCase: jest.Mocked<IUsersUseCase>;

  beforeEach(() => {
    useCase = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUsername: jest.fn(),
      findByUsernameWithPassword: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new UsersController(useCase);
  });

  it('should call findAll on useCase', async () => {
    useCase.findAll.mockResolvedValue([]);
    await expect(controller.findAll()).resolves.toEqual([]);
    expect(useCase.findAll).toHaveBeenCalled();
  });

  it('should call findById on useCase', async () => {
    const user = { id: '1', username: 'admin', name: 'Admin', role: 'ADMIN', isActive: true };
    useCase.findById.mockResolvedValue(user);
    await expect(controller.findOne('1')).resolves.toEqual(user);
    expect(useCase.findById).toHaveBeenCalledWith('1');
  });

  it('should throw BadRequestException if email is missing or empty in create', () => {
    expect(() =>
      controller.create({
        username: 'admin',
        password: 'password',
        name: 'Admin',
        email: '   ',
      }),
    ).toThrow(BadRequestException);
  });

  it('should call create on useCase when email is provided', async () => {
    const createData = {
      username: 'admin',
      password: 'password',
      name: 'Admin',
      email: 'admin@bcpos.space',
    };
    const user = { id: '1', ...createData, role: 'ADMIN', isActive: true };
    useCase.create.mockResolvedValue(user);
    await expect(controller.create(createData)).resolves.toEqual(user);
    expect(useCase.create).toHaveBeenCalledWith(createData);
  });

  it('should call update on useCase', async () => {
    const updateData = { name: 'New Name' };
    const user = { id: '1', username: 'admin', name: 'New Name', role: 'ADMIN', isActive: true };
    useCase.update.mockResolvedValue(user);
    await expect(controller.update('1', updateData)).resolves.toEqual(user);
    expect(useCase.update).toHaveBeenCalledWith('1', updateData);
  });

  it('should call remove on useCase', async () => {
    useCase.remove.mockResolvedValue(undefined);
    await expect(controller.remove('1')).resolves.toBeUndefined();
    expect(useCase.remove).toHaveBeenCalledWith('1');
  });
});
