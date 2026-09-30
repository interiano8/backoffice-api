import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  UseGuards,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import type { IUsersUseCase, CreateUserData, UpdateUserData } from './domain/ports/in/users.use-case.port';
import { USERS_USE_CASE } from './users.tokens';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    @Inject(USERS_USE_CASE) private readonly usersUseCase: IUsersUseCase,
  ) {}

  @Get()
  findAll(@Query('storeCode') storeCode?: string) {
    return this.usersUseCase.findAll(storeCode);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersUseCase.findById(id);
  }

  @Post()
  create(@Body() data: CreateUserData) {
    if (!data.email || !data.email.trim()) {
      throw new BadRequestException('El correo electrónico es obligatorio.');
    }
    return this.usersUseCase.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateUserData) {
    return this.usersUseCase.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersUseCase.remove(id);
  }
}
