export interface DashboardProductRow {
  productName: string;
  totalVolume: number;
  totalAmount: number;
}

export interface DashboardDailyVolumeRow {
  date: Date;
  totalVolume: number;
  totalAmount: number;
}

export interface DashboardAttendantRow {
  employeeName: string;
  totalVolume: number;
  totalAmount: number;
  transactionCount: number;
}

export interface DashboardStatsResult {
  products: DashboardProductRow[];
  dailyVolume: DashboardDailyVolumeRow[];
  attendants: DashboardAttendantRow[];
  [key: string]: any;
}

export interface GlobalDashboardResult {
  totalAmount: number;
  totalVolumeGL: number;
  totalTransactions: number;
  activeStoresCount: number;
  storeRanking: Array<{
    storeCode: string;
    storeName: string;
    totalAmount: number;
    totalVolumeGL: number;
    transactionCount: number;
  }>;
  products: Array<{
    name: string;
    productName: string;
    totalAmount: number;
    totalVolumeGL: number;
    count: number;
  }>;
  paymentMethods: Array<{
    name: string;
    amount: number;
    count: number;
  }>;
  dailySales: Array<{
    date: string;
    totalAmount: number;
    totalVolumeGL: number;
  }>;
  hourlyTraffic: Array<{
    hour: string;
    amount: number;
    volume: number;
    TOTAL: number;
  }>;
}

export interface MonthlyAnalysisResult {
  period1: any;
  period2: any;
  discountComparison: any;
  fuelGrowth: any;
}

export interface DashboardRepository {
  getDashboardStats(
    storeCode: string,
    days?: number,
    date?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<DashboardStatsResult>;
  getGlobalDashboardStats(
    days?: number,
    date?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalDashboardResult>;
  getMonthlyAnalysis(
    storeCode: string,
    startDate1: string,
    endDate1: string,
    startDate2: string,
    endDate2: string,
  ): Promise<MonthlyAnalysisResult>;
}
