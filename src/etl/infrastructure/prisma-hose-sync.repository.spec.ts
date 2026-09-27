import { Logger } from '@nestjs/common';
import { PrismaHoseSyncRepository } from './prisma-hose-sync.repository';
import type { DbExecutor } from '../../common/connections/db-executor.interface';

describe('PrismaHoseSyncRepository', () => {
  let repo: PrismaHoseSyncRepository;
  let prisma: { boHose: { findMany: jest.Mock; createMany: jest.Mock } };
  let pool: DbExecutor & { query: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma = {
      boHose: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    pool = {
      query: jest.fn().mockResolvedValue({ recordset: [], rowsAffected: [0] }),
      queryParams: jest.fn(),
      execute: jest.fn(),
      close: jest.fn(),
    };
    repo = new PrismaHoseSyncRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('getHoseConfiguration', () => {
    it('should build hose and product maps from found hoses', async () => {
      prisma.boHose.findMany.mockResolvedValue([
        {
          storeCode: 'S01',
          pumpId: 1,
          hoseId: 1,
          hosePhysicalId: 9,
          unitOfMeasure: 'LT',
          gradeName: 'Regular',
          tankId: 'T1',
          genericCode: 'G-REG',
        },
        {
          storeCode: 'S01',
          pumpId: 2,
          hoseId: 3,
          hosePhysicalId: undefined,
          unitOfMeasure: undefined,
          gradeName: '',
          tankId: undefined,
          genericCode: 'g-x',
        },
        {
          storeCode: 'S01',
          pumpId: 4,
          hoseId: 5,
          hosePhysicalId: null,
          unitOfMeasure: 'GL',
          gradeName: '  Diesel  ',
          tankId: '',
          genericCode: null,
        },
      ]);

      const result = await repo.getHoseConfiguration('S01');

      expect(result.hoseMap).toEqual({
        '1-9': {
          unit: 'LT',
          grade: 'Regular',
          tankId: 'T1',
          hoseId: 1,
        },
        '2-3': { unit: 'LT', grade: 'Producto', tankId: '', hoseId: 3 },
        '4-5': { unit: 'GL', grade: '  Diesel  ', tankId: '', hoseId: 5 },
      });
      expect(result.productMap).toEqual({
        REGULAR: { unit: 'LT', standardName: 'Regular' },
        'G-REG': { unit: 'LT', standardName: 'Regular' },
        'G-X': { unit: 'LT', standardName: 'g-x' },
        DIESEL: { unit: 'GL', standardName: '  Diesel  ' },
      });
      expect(prisma.boHose.findMany).toHaveBeenCalledWith({
        where: { storeCode: 'S01' },
      });
    });

    it('should return empty maps when no hoses exist', async () => {
      prisma.boHose.findMany.mockResolvedValue([]);
      await expect(repo.getHoseConfiguration('S01')).resolves.toEqual({
        hoseMap: {},
        productMap: {},
      });
    });

    it('should log and return empty maps when the query fails', async () => {
      prisma.boHose.findMany.mockRejectedValue(new Error('db down'));
      await expect(repo.getHoseConfiguration('S01')).resolves.toEqual({
        hoseMap: {},
        productMap: {},
      });
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error fetching Hose configuration:',
        expect.any(Error),
      );
    });
  });

  describe('syncHoses', () => {
    const fullRow = {
      HoseID: '2',
      PumpID: '1',
      GradeNumber: '5',
      GradeName: 'Premium',
      PricePerUnit: '110.5',
      TankIDs: 'T1',
      HosePhysicalID: '7',
      CodigoPOS: 'POS-1',
      CodigoGenerico: 'GEN-PRE',
      UnidadMedida: 'LT',
      EsVisible: true,
    };

    it('should map records and create new hoses', async () => {
      pool.query.mockResolvedValue({
        recordset: [
          fullRow,
          {
            HoseID: '3',
            PumpID: '2',
            GradeNumber: '0',
            GradeName: undefined,
            PricePerUnit: 'abc',
            TankIDs: null,
            HosePhysicalID: null,
            CodigoPOS: null,
            CodigoGenerico: 'GEN-X',
            UnidadMedida: undefined,
            EsVisible: 1,
          },
          {
            HoseID: '4',
            PumpID: '3',
            GradeNumber: undefined,
            GradeName: 'Diesel',
            PricePerUnit: undefined,
            TankIDs: undefined,
            HosePhysicalID: null,
            CodigoPOS: undefined,
            CodigoGenerico: null,
            UnidadMedida: null,
            EsVisible: null,
          },
          {
            HoseID: '5',
            PumpID: undefined,
            GradeNumber: undefined,
            GradeName: undefined,
            PricePerUnit: undefined,
            TankIDs: undefined,
            HosePhysicalID: '1',
            CodigoPOS: undefined,
            CodigoGenerico: null,
            UnidadMedida: undefined,
            EsVisible: false,
          },
        ],
        rowsAffected: [4],
      });

      await repo.syncHoses(pool, 'S01');

      expect(prisma.boHose.createMany).toHaveBeenCalledWith({
        data: [
          {
            storeCode: 'S01',
            pumpId: 1,
            hoseId: 2,
            gradeId: 5,
            gradeName: 'GEN-PRE',
            unitPrice: 110.5,
            tankId: 'T1',
            hosePhysicalId: 7,
            posCode: 'POS-1',
            genericCode: 'GEN-PRE',
            unitOfMeasure: 'LT',
            active: true,
          },
          {
            storeCode: 'S01',
            pumpId: 2,
            hoseId: 3,
            gradeId: 0,
            gradeName: 'GEN-X',
            unitPrice: 0,
            tankId: null,
            hosePhysicalId: null,
            posCode: null,
            genericCode: 'GEN-X',
            unitOfMeasure: 'LT',
            active: true,
          },
          {
            storeCode: 'S01',
            pumpId: 3,
            hoseId: 4,
            gradeId: 0,
            gradeName: 'Diesel',
            unitPrice: 0,
            tankId: null,
            hosePhysicalId: null,
            posCode: null,
            genericCode: null,
            unitOfMeasure: 'LT',
            active: true,
          },
          {
            storeCode: 'S01',
            pumpId: 0,
            hoseId: 5,
            gradeId: 0,
            gradeName: 'Combustible',
            unitPrice: 0,
            tankId: null,
            hosePhysicalId: 1,
            posCode: null,
            genericCode: null,
            unitOfMeasure: 'LT',
            active: false,
          },
        ],
      });
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('FROM mangueras'));
    });

    it('should only create hoses that do not already exist', async () => {
      pool.query.mockResolvedValue({
        recordset: [fullRow],
        rowsAffected: [1],
      });
      prisma.boHose.findMany.mockResolvedValue([
        { pumpId: 1, hoseId: 2 },
      ]);

      await repo.syncHoses(pool, 'S01');

      expect(prisma.boHose.createMany).not.toHaveBeenCalled();
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Synced 1 hoses for store S01'),
      );
    });

    it('should create only the new subset when some hoses already exist', async () => {
      const otherRow = {
        HoseID: '9',
        PumpID: '9',
        GradeNumber: '1',
        GradeName: 'Regular',
        PricePerUnit: '50',
        TankIDs: 'T2',
        HosePhysicalID: null,
        CodigoPOS: null,
        CodigoGenerico: null,
        UnidadMedida: 'LT',
        EsVisible: true,
      };
      pool.query.mockResolvedValue({
        recordset: [fullRow, otherRow],
        rowsAffected: [2],
      });
      prisma.boHose.findMany.mockResolvedValue([{ pumpId: 1, hoseId: 2 }]);

      await repo.syncHoses(pool, 'S01');

      expect(prisma.boHose.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ pumpId: 9, hoseId: 9 }),
        ],
      });
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Migrating 1 new hoses...'),
      );
    });
  });
});
