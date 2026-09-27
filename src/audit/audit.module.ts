import { Module, forwardRef } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { PrismaAuditRepository } from './infrastructure/prisma-audit.repository';
import { AuditUseCase } from './application/use-cases/audit.use-case';
import { AUDIT_REPOSITORY, AUDIT_USE_CASE } from './audit.tokens';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AuditController],
  providers: [
    { provide: AUDIT_REPOSITORY, useClass: PrismaAuditRepository },
    { provide: AUDIT_USE_CASE, useClass: AuditUseCase },
  ],
  exports: [AUDIT_USE_CASE],
})
export class AuditModule {}
