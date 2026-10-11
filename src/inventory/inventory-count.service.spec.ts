import { Test, TestingModule } from '@nestjs/testing';
import { InventoryCountService } from './inventory-count.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('InventoryCountService', () => {
  let service: InventoryCountService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      boStore: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.code === '001') {
            return Promise.resolve({ code: '001', name: 'Sucursal Centro' });
          }
          return Promise.resolve(null);
        }),
      },
      boInventory: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            storeCode: '001',
            productCode: 'PROD-001',
            productName: 'Aceite Motor',
            stock: 20,
          },
        ]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      boInventoryCountSession: {
        create: jest.fn().mockImplementation(({ data, include }) => {
          return Promise.resolve({
            id: 'session-1',
            sessionNo: data.sessionNo,
            storeCode: data.storeCode,
            status: data.status,
            countedBy: data.countedBy,
            notes: data.notes,
            items: data.items.create.map((it: any, idx: number) => ({
              id: `item-${idx + 1}`,
              sessionId: 'session-1',
              productCode: it.productCode,
              productName: it.productName,
              theoreticalStock: it.theoreticalStock,
              countedStock: it.countedStock,
              variance: it.variance,
            })),
          });
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'session-1') {
            return Promise.resolve({
              id: 'session-1',
              sessionNo: 'CNT-20261011-1234',
              storeCode: '001',
              status: 'DRAFT',
              countedBy: 'AUDITOR',
              items: [
                {
                  id: 'item-1',
                  sessionId: 'session-1',
                  productCode: 'PROD-001',
                  productName: 'Aceite Motor',
                  theoreticalStock: 20,
                  countedStock: 20,
                  variance: 0,
                  reason: null,
                },
              ],
            });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          return Promise.resolve({
            id: where.id,
            ...data,
          });
        }),
      },
      boInventoryCountItem: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      activityLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCountService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<InventoryCountService>(InventoryCountService);
  });

  describe('createCountSession', () => {
    it('should create session and snapshot theoretical stock', async () => {
      const session = await service.createCountSession({
        storeCode: '001',
        countedBy: 'JUAN',
        notes: 'Conteo mensual',
      });

      expect(session.sessionNo).toMatch(/^CNT-\d{8}-\d{4}$/);
      expect(session.storeCode).toBe('001');
      expect(session.items).toHaveLength(1);
      expect(session.items[0].productCode).toBe('PROD-001');
      expect(session.items[0].theoreticalStock).toBe(20);
    });

    it('should throw NotFoundException if store does not exist', async () => {
      await expect(
        service.createCountSession({ storeCode: '999' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCountItems', () => {
    it('should update countedStock, calculate variance and mark status COMPLETED', async () => {
      const res = await service.updateCountItems('session-1', {
        items: [
          {
            productCode: 'PROD-001',
            countedStock: 18,
            reason: 'MERMA_ROTURA',
          },
        ],
      });

      expect(prismaMock.boInventoryCountItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            countedStock: 18,
            variance: -2,
            reason: 'MERMA_ROTURA',
          }),
        }),
      );
      expect(prismaMock.boInventoryCountSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'COMPLETED' },
        }),
      );
    });
  });

  describe('applyAdjustments', () => {
    it('should update BoInventory stock, mark APPLIED, and log activity', async () => {
      const res = await service.applyAdjustments('session-1', {
        approvedBy: 'GERENTE_ROBERTO',
      });

      expect(prismaMock.boInventory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            storeCode_productCode: {
              storeCode: '001',
              productCode: 'PROD-001',
            },
          },
          update: expect.objectContaining({ stock: 20 }),
        }),
      );
      expect(prismaMock.activityLog.create).toHaveBeenCalled();
    });

    it('should reject applying already APPLIED session', async () => {
      prismaMock.boInventoryCountSession.findUnique.mockResolvedValueOnce({
        id: 'session-applied',
        status: 'APPLIED',
        items: [],
      });

      await expect(
        service.applyAdjustments('session-applied', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelCountSession', () => {
    it('should cancel active session', async () => {
      await service.cancelCountSession('session-1', { notes: 'Cancelado por error' });
      expect(prismaMock.boInventoryCountSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED',
          }),
        }),
      );
    });
  });
});
