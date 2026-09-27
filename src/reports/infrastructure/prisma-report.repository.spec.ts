import { PrismaReportRepository } from './prisma-report.repository';

describe('PrismaReportRepository', () => {
  let repo: PrismaReportRepository;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = { $queryRaw: jest.fn() };
    repo = new PrismaReportRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('getSalesDeclaration', () => {
    it('should return an empty array when no storeCode is provided', async () => {
      await expect(
        repo.getSalesDeclaration('2026-01-01', '2026-01-31', 'detallado'),
      ).resolves.toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should run the resumido query when type is resumido', async () => {
      const rows = [{ date: '2026-01-01', total: 100 }];
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await repo.getSalesDeclaration(
        '2026-01-01',
        '2026-01-31',
        'resumido',
        'S01',
      );

      expect(result).toEqual(rows);
      expect(prisma.$queryRaw).toHaveBeenCalledWith(
        expect.any(Array),
        '2026-01-01',
        '2026-01-31',
        'S01',
      );
      const sql = prisma.$queryRaw.mock.calls[0][0] as string[];
      expect(sql.join('?')).toContain('GROUP BY');
    });

    it('should run the detailed query for any other type', async () => {
      const rows = [{ date: '2026-01-01', pos: 'POS-1' }];
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await repo.getSalesDeclaration(
        '2026-01-01',
        '2026-01-31',
        'detallado',
        'S01',
      );

      expect(result).toEqual(rows);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const sql = prisma.$queryRaw.mock.calls[0][0] as string[];
      expect(sql.join('?')).toContain('Sale Date Time');
    });
  });

  it('should return an empty array for getCustomerStatement', async () => {
    await expect(
      repo.getCustomerStatement('2026-01-01', '2026-01-31', 'C001', 'S01'),
    ).resolves.toEqual([]);
  });

  it('should return an empty object for getBulkCustomerStatements', async () => {
    await expect(
      repo.getBulkCustomerStatements('2026-01-01', '2026-01-31', 'S01'),
    ).resolves.toEqual({});
  });

  it('should return an empty array for getActiveCustomers', async () => {
    await expect(
      repo.getActiveCustomers('2026-01-01', '2026-01-31', 'S01'),
    ).resolves.toEqual([]);
  });

  it('should return an empty object for getStoreUnitMappings', async () => {
    await expect(repo.getStoreUnitMappings('S01')).resolves.toEqual({});
  });
});
