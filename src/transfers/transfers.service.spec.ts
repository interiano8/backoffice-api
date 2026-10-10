import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('TransfersService & TransfersController', () => {
  let service: TransfersService;
  let controller: TransfersController;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      boStockTransfer: {
        create: jest.fn().mockImplementation(({ data, include }) => {
          return Promise.resolve({
            id: 'trf-uuid-1',
            transferNo: data.transferNo,
            fromStoreCode: data.fromStoreCode,
            toStoreCode: data.toStoreCode,
            status: data.status,
            requestedBy: data.requestedBy,
            notes: data.notes,
            createdAt: new Date(),
            updatedAt: new Date(),
            items: data.items.create.map((it: any, idx: number) => ({
              id: `item-${idx + 1}`,
              transferId: 'trf-uuid-1',
              productCode: it.productCode,
              productName: it.productName,
              quantityRequested: it.quantityRequested,
              quantityDispatched: null,
              quantityReceived: null,
            })),
          });
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'trf-uuid-1',
            transferNo: 'TRF-20261010-1234',
            fromStoreCode: '001',
            toStoreCode: '002',
            status: 'REQUESTED',
            items: [],
          },
        ]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'trf-uuid-1') {
            return Promise.resolve({
              id: 'trf-uuid-1',
              transferNo: 'TRF-20261010-1234',
              fromStoreCode: '001',
              toStoreCode: '002',
              status: 'REQUESTED',
              notes: 'Urgente',
              items: [
                {
                  id: 'item-1',
                  productCode: 'OIL-5W30',
                  quantityRequested: 5,
                  quantityDispatched: null,
                  quantityReceived: null,
                },
              ],
            });
          }
          if (where.id === 'trf-approved') {
            return Promise.resolve({
              id: 'trf-approved',
              transferNo: 'TRF-20261010-5678',
              fromStoreCode: '001',
              toStoreCode: '002',
              status: 'APPROVED',
              items: [
                {
                  id: 'item-1',
                  productCode: 'OIL-5W30',
                  quantityRequested: 5,
                  quantityDispatched: null,
                  quantityReceived: null,
                },
              ],
            });
          }
          if (where.id === 'trf-transit') {
            return Promise.resolve({
              id: 'trf-transit',
              transferNo: 'TRF-20261010-9999',
              fromStoreCode: '001',
              toStoreCode: '002',
              status: 'IN_TRANSIT',
              items: [
                {
                  id: 'item-1',
                  productCode: 'OIL-5W30',
                  quantityRequested: 5,
                  quantityDispatched: 5,
                  quantityReceived: null,
                },
              ],
            });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          return Promise.resolve({
            id: where.id,
            status: data.status,
            ...data,
          });
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const txMock = {
          boInventory: {
            findUnique: jest.fn().mockImplementation(({ where }) => {
              if (where.storeCode_productCode.productCode === 'LOW_STOCK') {
                return Promise.resolve({ stock: 1 });
              }
              return Promise.resolve({ stock: 50 });
            }),
            update: jest.fn().mockResolvedValue({}),
            upsert: jest.fn().mockResolvedValue({}),
          },
          boStockTransferItem: {
            update: jest.fn().mockResolvedValue({}),
          },
          boStockTransfer: {
            update: jest.fn().mockImplementation(({ where, data }) => {
              return Promise.resolve({
                id: where.id,
                ...data,
              });
            }),
          },
        };
        return callback(txMock);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransfersController],
      providers: [
        TransfersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
    controller = module.get<TransfersController>(TransfersController);
  });

  it('should create a new transfer request', async () => {
    const res = await service.createTransfer({
      fromStoreCode: '001',
      toStoreCode: '002',
      requestedBy: 'CAJERO-1',
      notes: 'Falta stock en tienda',
      items: [{ productCode: 'OIL-5W30', productName: 'Aceite 5W30', quantity: 4 }],
    });

    expect(res).toBeDefined();
    expect(res.status).toBe('REQUESTED');
    expect(res.fromStoreCode).toBe('001');
    expect(res.toStoreCode).toBe('002');
    expect(res.items).toHaveLength(1);
  });

  it('should reject transfer when origin and destination are identical', async () => {
    await expect(
      service.createTransfer({
        fromStoreCode: '001',
        toStoreCode: '001',
        requestedBy: 'CAJERO-1',
        items: [{ productCode: 'OIL-5W30', quantity: 2 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should approve a REQUESTED transfer', async () => {
    const res = await service.approveTransfer('trf-uuid-1', 'SUPERVISOR');
    expect(res.status).toBe('APPROVED');
    expect(prismaMock.boStockTransfer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'trf-uuid-1' },
        data: expect.objectContaining({ status: 'APPROVED', approvedBy: 'SUPERVISOR' }),
      }),
    );
  });

  it('should dispatch an APPROVED transfer and transition to IN_TRANSIT', async () => {
    const res = await service.dispatchTransfer('trf-approved', {
      dispatchedBy: 'BODEGUERO',
    });
    expect(res.status).toBe('IN_TRANSIT');
  });

  it('should receive an IN_TRANSIT transfer and transition to RECEIVED', async () => {
    const res = await service.receiveTransfer('trf-transit', {
      receivedBy: 'ENCARGADO_DESTINO',
    });
    expect(res.status).toBe('RECEIVED');
  });

  it('should cancel a transfer in REQUESTED state', async () => {
    const res = await service.cancelTransfer('trf-uuid-1', { reason: 'No requerido' });
    expect(res.status).toBe('CANCELLED');
  });

  it('should prevent cancelling a transfer in IN_TRANSIT state', async () => {
    await expect(
      service.cancelTransfer('trf-transit', { reason: 'Error' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('controller should expose endpoints and forward to service', async () => {
    const list = await controller.getTransfers('001', 'REQUESTED');
    expect(list).toBeDefined();
    expect(prismaMock.boStockTransfer.findMany).toHaveBeenCalled();
  });
});
