import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersTpvRepository } from './infrastructure/customers-tpv.repository';
import { CustomersUseCase } from './application/use-cases/customers.use-case';
import { CUSTOMER_REPOSITORY, CUSTOMERS_USE_CASE } from './customers.tokens';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [CustomersController],
  providers: [
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: CustomersTpvRepository,
    },
    {
      provide: CUSTOMERS_USE_CASE,
      useClass: CustomersUseCase,
    },
  ],
  exports: [CUSTOMERS_USE_CASE],
})
export class CustomersModule {}
