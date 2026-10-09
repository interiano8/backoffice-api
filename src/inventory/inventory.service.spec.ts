import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('InventoryService & InventoryController', () => {
  let service: InventoryService;
  let controller: InventoryController;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      boStore: {
        findMany: jest.fn().mockResolvedValue([
          { code: '001', name: 'Sucursal Centro', isActive: true },
          { code: '002', name: 'Sucursal Norte', isActive: true },
        ]),
      },
      boInventory: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            storeCode: '001',
            productCode: 'PROD-001',
            productName: 'Aceite Motor',
            stock: 25,
            minStock: 5,
            updatedAt: new Date('2026-10-09T10:00:00Z'),
          },
          {
            id: 'inv-2',
            storeCode: '002',
            productCode: 'PROD-001',
            productName: 'Aceite Motor',
            stock: 10,
            minStock: 2,
            updatedAt: new Date('2026-10-09T11:00:00Z'),
          },
        ]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.storeCode_productCode.storeCode === '001') {
            return Promise.resolve({
              id: 'inv-1',
              storeCode: '001',
              productCode: 'PROD-001',
              productName: 'Aceite Motor',
              stock: 25,
              minStock: 5,
              updatedAt: new Date('2026-10-09T10:00:00Z'),
            });
          }
          return Promise.resolve(null);
        }),
        upsert: jest.fn().mockImplementation(({ where, update, create }) => {
          return Promise.resolve({
            id: 'inv-1',
            storeCode: where.storeCode_productCode.storeCode,
            productCode: where.storeCode_productCode.productCode,
            productName: 'Aceite Motor',
            stock: 30,
            minStock: 5,
            updatedAt: new Date('2026-10-09T12:00:00Z'),
          });
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    controller = module.get<InventoryController>(InventoryController);
  });

  describe('InventoryService', () => {
    it('should return network inventory across all active stores', async () => {
      const res = await service.getNetworkInventory('PROD-001');

      expect(res.productCode).toBe('PROD-001');
      expect(res.items).toHaveLength(2);
      expect(res.items[0]).toEqual({
        storeCode: '001',
        storeName: 'Sucursal Centro',
        stock: 25,
        minStock: 5,
        isAvailable: true,
        updatedAt: '2026-10-09T10:00:00.000Z',
      });
      expect(res.items[1].stock).toBe(10);
      expect(res.totalNetworkStock).toBe(35);
    });

    it('should return single store inventory', async () => {
      const res = await service.getStoreInventory('001', 'PROD-001');

      expect(res.storeCode).toBe('001');
      expect(res.stock).toBe(25);
      expect(res.isAvailable).toBe(true);
    });

    it('should return zero stock if store has no inventory record', async () => {
      const res = await service.getStoreInventory('999', 'PROD-001');

      expect(res.stock).toBe(0);
      expect(res.isAvailable).toBe(false);
    });

    it('should adjust stock via upsert', async () => {
      const res = await service.adjustStock('001', 'PROD-001', 5, 'Aceite Motor');

      expect(prismaMock.boInventory.upsert).toHaveBeenCalled();
      expect(res.stock).toBe(30);
    });
  });

  describe('InventoryController', () => {
    it('should expose network inventory endpoint', async () => {
      const res = await controller.getNetworkInventory('PROD-001');
      expect(res.totalNetworkStock).toBe(35);
    });

    it('should expose single store inventory endpoint', async () => {
      const res = await controller.getStoreInventory('001', 'PROD-001');
      expect(res.stock).toBe(25);
    });

    it('should expose adjust stock endpoint', async () => {
      const res = await controller.adjustStock({
        storeCode: '001',
        productCode: 'PROD-001',
        quantityDelta: 5,
      });
      expect(res.stock).toBe(30);
    });
  });
});
