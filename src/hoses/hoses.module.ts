import { Module } from '@nestjs/common';
import { HosesUseCase } from './application/use-cases/hoses.use-case';
import { PrismaHoseRepository } from './infrastructure/prisma-hose.repository';
import { HosesController } from './hoses.controller';
import { HOSES_USE_CASE, HOSE_REPOSITORY } from './hoses.tokens';

@Module({
  controllers: [HosesController],
  providers: [
    { provide: HOSES_USE_CASE, useClass: HosesUseCase },
    { provide: HOSE_REPOSITORY, useClass: PrismaHoseRepository },
  ],
  exports: [HOSES_USE_CASE, HOSE_REPOSITORY],
})
export class HosesModule {}
