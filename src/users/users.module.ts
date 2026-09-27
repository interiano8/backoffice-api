import { Module } from '@nestjs/common';
import { UsersUseCase } from './application/use-cases/users.use-case';
import { TpvUserRepository } from './infrastructure/tpv-user.repository';
import { UsersController } from './users.controller';
import { USERS_USE_CASE, USER_REPOSITORY } from './users.tokens';
import { ConnectionsModule } from '../common/connections/connections.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConnectionsModule, PrismaModule],
  controllers: [UsersController],
  providers: [
    { provide: USERS_USE_CASE, useClass: UsersUseCase },
    { provide: USER_REPOSITORY, useClass: TpvUserRepository },
  ],
  exports: [USERS_USE_CASE, USER_REPOSITORY],
})
export class UsersModule {}
