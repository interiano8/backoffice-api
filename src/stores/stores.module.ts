import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { PrismaStoresRepository } from './infrastructure/prisma-stores.repository';
import { StoresUseCase } from './application/use-cases/stores.use-case';
import { STORES_REPOSITORY, STORES_USE_CASE } from './stores.tokens';
import { StoreHealthService } from './store-health.service';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [StoresController],
  providers: [
    { provide: STORES_REPOSITORY, useClass: PrismaStoresRepository },
    { provide: STORES_USE_CASE, useClass: StoresUseCase },
    StoreHealthService,
  ],
  exports: [STORES_USE_CASE, StoreHealthService],
})
export class StoresModule {}
