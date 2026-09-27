import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocsTpvRepository } from './infrastructure/docs-tpv.repository';
import { DocsUseCase } from './application/use-cases/docs.use-case';
import { DOC_REPOSITORY, DOCS_USE_CASE } from './documents.tokens';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [DocumentsController],
  providers: [
    { provide: DOC_REPOSITORY, useClass: DocsTpvRepository },
    { provide: DOCS_USE_CASE, useClass: DocsUseCase },
  ],
  exports: [DOCS_USE_CASE],
})
export class DocsModule {}
