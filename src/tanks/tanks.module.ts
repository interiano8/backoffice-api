import { Module } from '@nestjs/common';
import { TanksController } from './tanks.controller';
import { PrismaTanksRepository } from './infrastructure/prisma-tanks.repository';
import { TanksUseCase } from './application/use-cases/tanks.use-case';
import { TANKS_REPOSITORY, TANKS_USE_CASE } from './tanks.tokens';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TanksController],
  providers: [
    { provide: TANKS_REPOSITORY, useClass: PrismaTanksRepository },
    { provide: TANKS_USE_CASE, useClass: TanksUseCase },
  ],
  exports: [TANKS_USE_CASE],
})
export class TanksModule {}
