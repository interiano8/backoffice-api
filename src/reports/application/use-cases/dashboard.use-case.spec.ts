import { DashboardUseCase } from './dashboard.use-case';
import type { DashboardRepository } from '../../domain/ports/dashboard-repository.interface';

describe('DashboardUseCase', () => {
  let useCase: DashboardUseCase;
  let mockRepo: jest.Mocked<DashboardRepository>;

  const mockStats = {
    totalVolume: 50000,
    totalSales: 1500000,
    productBreakdown: [],
  };

  beforeEach(() => {
    mockRepo = {
      getDashboardStats: jest.fn().mockResolvedValue(mockStats as any),
      getGlobalDashboardStats: jest.fn().mockResolvedValue(mockStats as any),
      getMonthlyAnalysis: jest.fn().mockResolvedValue({ comparison: [] } as any),
    };
    useCase = new DashboardUseCase(mockRepo);
  });

  it('should retrieve dashboard stats for a store', async () => {
    const result = await useCase.getDashboardStats('STORE01', 30);
    expect(mockRepo.getDashboardStats).toHaveBeenCalledWith('STORE01', 30, undefined, undefined, undefined);
    expect(result).toEqual(mockStats);
  });

  it('should retrieve global dashboard stats across all stores', async () => {
    const result = await useCase.getGlobalDashboardStats(15, '2026-08-31');
    expect(mockRepo.getGlobalDashboardStats).toHaveBeenCalledWith(15, '2026-08-31', undefined, undefined);
    expect(result).toEqual(mockStats);
  });

  it('should calculate monthly comparative analysis', async () => {
    const result = await useCase.getMonthlyAnalysis('STORE01', '2026-07-01', '2026-07-31', '2026-08-01', '2026-08-31');
    expect(mockRepo.getMonthlyAnalysis).toHaveBeenCalledWith('STORE01', '2026-07-01', '2026-07-31', '2026-08-01', '2026-08-31');
    expect(result).toHaveProperty('comparison');
  });
});
