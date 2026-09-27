import { Logger } from '@nestjs/common';
import { PrismaStatementRepository } from './prisma-statement.repository';

describe('PrismaStatementRepository', () => {
  let repo: PrismaStatementRepository;
  let prisma: {
    $queryRaw: jest.Mock;
    boHose: { findMany: jest.Mock };
    boStore: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      boHose: { findMany: jest.fn().mockResolvedValue([]) },
      boStore: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    repo = new PrismaStatementRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('getActiveCustomers', () => {
    it('should normalize numeric totals from raw rows', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { customerNo: 'C1', totalCredit: '100', totalNC: '20' },
        { customerNo: 'C2', totalCredit: null, totalNC: '5.5' },
      ]);

      const result = await repo.getActiveCustomers('2026-01-01', '2026-01-31', 'S01');

      expect(result).toEqual([
        { customerNo: 'C1', totalCredit: 100, totalNC: 20 },
        { customerNo: 'C2', totalCredit: 0, totalNC: 5.5 },
      ]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      const sql = prisma.$queryRaw.mock.calls[0][0] as string[];
      expect(sql.join('?')).toContain('POS Sales Doc_ Type');
    });
  });

  describe('getStoreUnitMappings', () => {
    it('should return empty mappings without a storeCode', async () => {
      await expect(repo.getStoreUnitMappings()).resolves.toEqual({});
      expect(prisma.boHose.findMany).not.toHaveBeenCalled();
    });

    it('should map grades and generic codes to units', async () => {
      prisma.boHose.findMany.mockResolvedValue([
        { gradeName: 'Regular', genericCode: 'G-REG', unitOfMeasure: 'LT' },
        { gradeName: 'Diesel', genericCode: null, unitOfMeasure: 'GL' },
        { gradeName: null, genericCode: 'G-X', unitOfMeasure: null },
      ]);

      await expect(repo.getStoreUnitMappings('S01')).resolves.toEqual({
        Regular: 'LT',
        'G-REG': 'LT',
        Diesel: 'GL',
        'G-X': 'LT',
      });
    });

    it('should log and return empty mappings on error', async () => {
      prisma.boHose.findMany.mockRejectedValue(new Error('db down'));
      await expect(repo.getStoreUnitMappings('S01')).resolves.toEqual({});
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error fetching unit mappings:',
        expect.any(Error),
      );
    });
  });

  describe('getCustomerStatementRaw', () => {
    it('should run the raw customer statement query', async () => {
      const rows = [{ customerNo: 'C1' }];
      prisma.$queryRaw.mockResolvedValue(rows);

      await expect(
        repo.getCustomerStatementRaw('2026-01-01', '2026-01-31', 'C1', 'S01'),
      ).resolves.toEqual(rows);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllStatementsRaw', () => {
    it('should run the raw all statements query', async () => {
      const rows = [{ customerNo: 'C1' }];
      prisma.$queryRaw.mockResolvedValue(rows);

      await expect(
        repo.getAllStatementsRaw('2026-01-01', '2026-01-31'),
      ).resolves.toEqual(rows);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStoreShowDetails', () => {
    it('should return true when the store has no flag', async () => {
      prisma.boStore.findUnique.mockResolvedValue({ showDetailsInStatement: undefined });
      await expect(repo.getStoreShowDetails('S01')).resolves.toBe(true);
    });

    it('should return false when the store disables details', async () => {
      prisma.boStore.findUnique.mockResolvedValue({ showDetailsInStatement: false });
      await expect(repo.getStoreShowDetails('S01')).resolves.toBe(false);
    });

    it('should return true when the store is missing', async () => {
      await expect(repo.getStoreShowDetails('S01')).resolves.toBe(true);
    });

    it('should return true when the lookup throws', async () => {
      prisma.boStore.findUnique.mockRejectedValue(new Error('boom'));
      await expect(repo.getStoreShowDetails('S01')).resolves.toBe(true);
    });
  });

  describe('processStatements', () => {
    it('should compute balances and enrich product details', () => {
      const statements = [
        {
          docType: 2,
          amount: '100',
          productDetails: 'REGULAR (5 * 100) | Not A Pattern',
          fleetInfo: 'f1',
        },
        {
          docType: 3,
          amount: '-50',
          productDetails: 'VALE (2 * 10)',
          fleetInfo: 'f2',
        },
        { docType: 7, amount: 200, productDetails: '-', fleetInfo: 'f3' },
        { docType: 1, amount: '30', productDetails: null, fleetInfo: 'f4' },
      ];

      const result = repo.processStatements(statements, true, { REGULAR: 'GL' });

      expect(result[0]).toEqual({
        docType: 2,
        amount: '100',
        productDetails: 'REGULAR (5 GL * 100) | Not A Pattern',
        fleetInfo: 'f1',
        charge: 100,
        payment: 0,
        balance: 100,
      });
      expect(result[1].payment).toBe(50);
      expect(result[1].balance).toBe(50);
      expect(result[1].productDetails).toBe('VALE (2 LT * 10)');
      expect(result[2].charge).toBe(200);
      expect(result[2].balance).toBe(250);
      expect(result[2].productDetails).toBe('-');
      expect(result[3].charge).toBe(0);
      expect(result[3].payment).toBe(0);
      expect(result[3].balance).toBe(250);
      expect(result[3].productDetails).toBeNull();
    });
  });
});