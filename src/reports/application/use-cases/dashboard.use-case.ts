import { Injectable, Inject } from '@nestjs/common';
import { IDashboardUseCase } from '../../domain/ports/in/dashboard.use-case.port';
import type { DashboardRepository } from '../../domain/ports/dashboard-repository.interface';
import { DASHBOARD_REPOSITORY } from '../../reports.tokens';

@Injectable()
export class DashboardUseCase implements IDashboardUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly dashboardRepo: DashboardRepository,
  ) {}

  async getDashboardStats(
    storeCode: string,
    days: number = 15,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    return this.dashboardRepo.getDashboardStats(
      storeCode,
      days,
      date,
      startDate,
      endDate,
    );
  }

  async getGlobalDashboardStats(
    days: number = 15,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    return this.dashboardRepo.getGlobalDashboardStats(
      days,
      date,
      startDate,
      endDate,
    );
  }

  async getMonthlyAnalysis(
    storeCode: string,
    startDate1: string,
    endDate1: string,
    startDate2: string,
    endDate2: string,
  ) {
    return this.dashboardRepo.getMonthlyAnalysis(
      storeCode,
      startDate1,
      endDate1,
      startDate2,
      endDate2,
    );
  }
}
