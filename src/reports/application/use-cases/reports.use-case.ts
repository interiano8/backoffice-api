import { Injectable, Inject } from '@nestjs/common';
import { IReportsUseCase } from '../../domain/ports/in/reports.use-case.port';
import type { ReportRepository } from '../../domain/ports/report-repository.interface';
import { REPORT_REPOSITORY } from '../../reports.tokens';

@Injectable()
export class ReportsUseCase implements IReportsUseCase {
  constructor(
    @Inject(REPORT_REPOSITORY) private readonly reportRepo: ReportRepository,
  ) {}

  async getSalesDeclaration(
    startDate: string,
    endDate: string,
    type: 'resumido' | 'detallado',
    storeCode?: string,
  ) {
    return this.reportRepo.getSalesDeclaration(
      startDate,
      endDate,
      type,
      storeCode,
    );
  }
}
