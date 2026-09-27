import { Controller, Get, Query, UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AUDIT_USE_CASE } from './audit.tokens';
import type { IAuditUseCase } from './domain/ports/in/audit.use-case.port';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(
    @Inject(AUDIT_USE_CASE)
    private readonly auditUseCase: IAuditUseCase,
  ) {}

  @Get()
  findAll(
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('storeCode') storeCode?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditUseCase.findAll({
      action,
      entity,
      storeCode,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }
}
