import {
  Controller,
  Get,
  Query,
  UseGuards,
  Headers,
  Inject,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  REPORTS_USE_CASE,
  CUSTOMER_STATEMENT_USE_CASE,
  DASHBOARD_USE_CASE,
} from './reports.tokens';
import type { IReportsUseCase } from './domain/ports/in/reports.use-case.port';
import type { ICustomerStatementUseCase } from './domain/ports/in/customer-statement.use-case.port';
import type { IDashboardUseCase } from './domain/ports/in/dashboard.use-case.port';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    @Inject(REPORTS_USE_CASE)
    private readonly reportsUseCase: IReportsUseCase,
    @Inject(CUSTOMER_STATEMENT_USE_CASE)
    private readonly customerStatementUseCase: ICustomerStatementUseCase,
    @Inject(DASHBOARD_USE_CASE)
    private readonly dashboardUseCase: IDashboardUseCase,
  ) {}

  @Get('dashboard-stats')
  async getDashboardStats(
    @Query('days') days: number = 15,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Headers('x-store-code') storeCode?: string,
  ) {
    if (storeCode === 'GLOBAL' || storeCode === '000') {
      return this.dashboardUseCase.getGlobalDashboardStats(
        Number(days),
        date,
        startDate,
        endDate,
      );
    }
    return this.dashboardUseCase.getDashboardStats(
      storeCode || '',
      Number(days),
      date,
      startDate,
      endDate,
    );
  }

  @Get('dashboard-global')
  async getGlobalDashboardStats(
    @Query('days') days: number = 15,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardUseCase.getGlobalDashboardStats(
      Number(days),
      date,
      startDate,
      endDate,
    );
  }

  @Get('active-customers')
  async getActiveCustomers(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Headers('x-store-code') storeCode?: string,
  ) {
    return this.customerStatementUseCase.getActiveCustomers(
      startDate,
      endDate,
      storeCode,
    );
  }

  @Get('customer-statement')
  async getCustomerStatement(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('customerNo') customerNo: string,
    @Headers('x-store-code') storeCode?: string,
  ) {
    return this.customerStatementUseCase.getCustomerStatement(
      startDate,
      endDate,
      customerNo,
      storeCode,
    );
  }

  @Get('sales-declaration')
  async getSalesDeclaration(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('type') type: 'resumido' | 'detallado',
    @Headers('x-store-code') storeCode?: string,
  ) {
    return this.reportsUseCase.getSalesDeclaration(
      startDate,
      endDate,
      type,
      storeCode,
    );
  }

  @Get('bulk-customer-statements')
  async getBulkCustomerStatements(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Headers('x-store-code') storeCode?: string,
  ) {
    return this.customerStatementUseCase.getBulkCustomerStatements(
      startDate,
      endDate,
      storeCode,
    );
  }

  @Get('monthly-analysis')
  async getMonthlyAnalysis(
    @Query('startDate1') startDate1: string,
    @Query('endDate1') endDate1: string,
    @Query('startDate2') startDate2: string,
    @Query('endDate2') endDate2: string,
    @Headers('x-store-code') storeCode?: string,
  ) {
    return this.dashboardUseCase.getMonthlyAnalysis(
      storeCode || '',
      startDate1,
      endDate1,
      startDate2,
      endDate2,
    );
  }

  @Get('consolidated/export')
  async exportConsolidatedReport(
    @Res({ passthrough: true }) res: any,
    @Query('days') days: number = 15,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const stats = await this.dashboardUseCase.getGlobalDashboardStats(
      Number(days),
      date,
      startDate,
      endDate,
    );

    const actualStart =
      startDate ||
      date ||
      new Date(Date.now() - Number(days) * 86400000).toISOString().split('T')[0];
    const actualEnd =
      endDate || date || new Date().toISOString().split('T')[0];

    const lines: string[] = [];
    lines.push('REPORTE CONSOLIDADO DE OPERACIONES - RED GLOBAL PRISMA');
    lines.push(`Periodo: ${actualStart} al ${actualEnd}`);
    lines.push(`Generado: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('RESUMEN GENERAL');
    lines.push('Total Ventas (L.),Total Galones,Total Transacciones');
    lines.push(
      `"${stats.totalAmount.toFixed(2)}","${stats.totalVolumeGL.toFixed(2)}","${stats.totalTransactions}"`,
    );
    lines.push('');
    lines.push('VOLUMEN POR PRODUCTO');
    lines.push('Producto,Galones');
    for (const [prod, vol] of Object.entries(stats.productVolumes || {})) {
      lines.push(`"${prod}","${Number(vol).toFixed(2)}"`);
    }
    lines.push('');
    lines.push('VENTAS POR ESTACION DE SERVICIO');
    lines.push('Codigo,Nombre,Ventas (L.),Galones,Transacciones');
    for (const store of stats.storeRankings || []) {
      lines.push(
        `"${store.storeCode}","${store.storeName}","${store.totalAmount.toFixed(2)}","${store.totalVolumeGL.toFixed(2)}","${store.transactionCount}"`,
      );
    }

    const csvContent = lines.join('\r\n');
    const filename = `reporte-consolidado-prisma-${actualStart}-${actualEnd}.csv`;

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
    }

    return csvContent;
  }
}
