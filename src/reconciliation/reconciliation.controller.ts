import { Controller, Get, Post, Body, Query, UseGuards, Inject, Param } from '@nestjs/common';
import type { IReconciliationUseCase } from './domain/ports/in/reconciliation.use-case.port';
import { RECONCILIATION_USE_CASE } from './reconciliation.tokens';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FiscalAuditService } from './application/services/fiscal-audit.service';
import { PermissionsGuard } from '../auth/rbac/permissions.guard';
import { RequirePermissions } from '../auth/rbac/require-permissions.decorator';

@Controller('reconciliation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReconciliationController {
  constructor(
    @Inject(RECONCILIATION_USE_CASE)
    private readonly reconciliationUseCase: IReconciliationUseCase,
    private readonly fiscalAuditService: FiscalAuditService,
  ) {}

  @Get('fiscal-gaps')
  @RequirePermissions('shifts:reconcile')
  getFiscalGaps(@Query('storeCode') storeCode?: string) {
    return this.fiscalAuditService.detectFiscalGaps(storeCode);
  }

  @Post()
  @RequirePermissions('shifts:reconcile')
  create(@Body() data: any) {
    return this.reconciliationUseCase.createReconciliation(data);
  }

  @Get()
  @RequirePermissions('shifts:reconcile')
  findAll(@Query('storeCode') storeCode?: string) {
    return this.reconciliationUseCase.getAll(storeCode);
  }

  @Get(':id')
  @RequirePermissions('shifts:reconcile')
  findOne(@Param('id') id: string) {
    return this.reconciliationUseCase.getById(id);
  }
}
