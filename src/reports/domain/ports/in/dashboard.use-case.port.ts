export interface IDashboardUseCase {
  getDashboardStats(
    storeCode: string,
    days?: number,
    date?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any>;

  getGlobalDashboardStats(
    days?: number,
    date?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any>;

  getMonthlyAnalysis(
    storeCode: string,
    startDate1: string,
    endDate1: string,
    startDate2: string,
    endDate2: string,
  ): Promise<any>;
}
