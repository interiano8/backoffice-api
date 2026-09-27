import { PrismaEtlSyncRepository } from './prisma-etl-sync.repository';
import type { DbExecutor } from '../../common/connections/db-executor.interface';

describe('PrismaEtlSyncRepository', () => {
  let repo: PrismaEtlSyncRepository;
  let hoseRepo: Record<string, jest.Mock>;
  let shiftRepo: Record<string, jest.Mock>;
  let saleRepo: Record<string, jest.Mock>;
  let paymentRepo: Record<string, jest.Mock>;

  const pool = {} as DbExecutor;
  const hoseConfig = { hoseMap: {}, productMap: {} };

  beforeEach(() => {
    jest.clearAllMocks();
    hoseRepo = {
      getHoseConfiguration: jest.fn().mockResolvedValue(hoseConfig),
      syncHoses: jest.fn().mockResolvedValue(undefined),
    };
    shiftRepo = {
      syncTpvShifts: jest.fn().mockResolvedValue(undefined),
      updateShiftTotals: jest.fn().mockResolvedValue(undefined),
    };
    saleRepo = {
      syncSaleHeaders: jest.fn().mockResolvedValue(undefined),
      syncTpvSales: jest.fn().mockResolvedValue(undefined),
    };
    paymentRepo = {
      syncPaymentMethods: jest.fn().mockResolvedValue(undefined),
    };
    repo = new PrismaEtlSyncRepository(
      hoseRepo as any,
      shiftRepo as any,
      saleRepo as any,
      paymentRepo as any,
    );
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  it('should delegate getHoseConfiguration to the hose repository', async () => {
    await expect(repo.getHoseConfiguration('S01')).resolves.toEqual(hoseConfig);
    expect(hoseRepo.getHoseConfiguration).toHaveBeenCalledWith('S01');
  });

  it('should delegate syncHoses to the hose repository', async () => {
    await expect(repo.syncHoses(pool, 'S01')).resolves.toBeUndefined();
    expect(hoseRepo.syncHoses).toHaveBeenCalledWith(pool, 'S01');
  });

  it('should delegate syncTpvShifts forwarding optional args', async () => {
    const date = new Date('2026-01-01');
    await expect(
      repo.syncTpvShifts(pool, 'S01', date, 'shift-1'),
    ).resolves.toBeUndefined();
    expect(shiftRepo.syncTpvShifts).toHaveBeenCalledWith(
      pool,
      'S01',
      date,
      'shift-1',
    );
  });

  it('should delegate syncTpvShifts without optional args', async () => {
    await expect(repo.syncTpvShifts(pool, 'S01')).resolves.toBeUndefined();
    expect(shiftRepo.syncTpvShifts).toHaveBeenCalledWith(
      pool,
      'S01',
      undefined,
      undefined,
    );
  });

  it('should delegate syncSaleHeaders forwarding optional args', async () => {
    const date = new Date('2026-01-01');
    await expect(
      repo.syncSaleHeaders(pool, 'S01', date, 'shift-1'),
    ).resolves.toBeUndefined();
    expect(saleRepo.syncSaleHeaders).toHaveBeenCalledWith(
      pool,
      'S01',
      date,
      'shift-1',
    );
  });

  it('should delegate syncTpvSales forwarding optional args', async () => {
    await expect(
      repo.syncTpvSales(pool, 'S01', hoseConfig, undefined, 'shift-1'),
    ).resolves.toBeUndefined();
    expect(saleRepo.syncTpvSales).toHaveBeenCalledWith(
      pool,
      'S01',
      hoseConfig,
      undefined,
      'shift-1',
    );
  });

  it('should delegate syncPaymentMethods forwarding optional args', async () => {
    const date = new Date('2026-01-01');
    await expect(
      repo.syncPaymentMethods(pool, 'S01', date, 'shift-1'),
    ).resolves.toBeUndefined();
    expect(paymentRepo.syncPaymentMethods).toHaveBeenCalledWith(
      pool,
      'S01',
      date,
      'shift-1',
    );
  });

  it('should delegate updateShiftTotals forwarding optional args', async () => {
    await expect(repo.updateShiftTotals('S01')).resolves.toBeUndefined();
    expect(shiftRepo.updateShiftTotals).toHaveBeenCalledWith(
      'S01',
      undefined,
      undefined,
    );
  });
});
