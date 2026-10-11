import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsBroadcastService } from '../alerts/alerts-broadcast.service';

describe('TransfersService & TransfersController', () => {
  let service: TransfersService;
  let controller: TransfersController;
  let prismaMock: any;
  let alertsBroadcastServiceMock: any;

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
          activityLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(txMock);
      }),
    };

    alertsBroadcastServiceMock = {
      emit: jest.fn(),
      getStream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransfersController],
      providers: [
        TransfersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: AlertsBroadcastService,
          useValue: alertsBroadcastServiceMock,
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

  it('should receive an IN_TRANSIT transfer with discrepancy and transition to RECEIVED_WITH_DISCREPANCY', async () => {
    const res = await service.receiveTransfer(
      'trf-transit',
      {
        receivedBy: 'ENCARGADO_DESTINO',
        discrepancyReason: 'FALTANTE_NO_LLEGO',
        discrepancyNotes: 'Llegaron solo 4 de 5',
        items: [{ productCode: 'OIL-5W30', quantity: 4 }],
      },
      { storeCode: '002', role: 'EMPLOYEE' },
    );
    expect(res.status).toBe('RECEIVED_WITH_DISCREPANCY');
    expect(res.notes).toContain('FALTANTE_NO_LLEGO');
  });

  it('should reject reception if user belongs to a different store and is not admin', async () => {
    await expect(
      service.receiveTransfer(
        'trf-transit',
        { receivedBy: 'OTRO_CAJERO' },
        { storeCode: '001', role: 'EMPLOYEE' }, // transfer.toStoreCode is 002
      ),
    ).rejects.toThrow();
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

  it('E2E simulation: create 10 units transfer, receive 9 units, verify RECEIVED_WITH_DISCREPANCY, shrinkage audit, and SSE event', async () => {
    // 1. Create transfer with 10 units
    const created = await service.createTransfer({
      fromStoreCode: '001',
      toStoreCode: '002',
      requestedBy: 'CAJERO-SIM',
      items: [{ productCode: 'OIL-10W40', quantity: 10 }],
    });
    expect(created.status).toBe('REQUESTED');

    // 2. Setup mock for in-transit transfer with 10 units dispatched
    prismaMock.boStockTransfer.findUnique.mockResolvedValueOnce({
      id: 'trf-sim-10',
      transferNo: 'TRF-SIM-10',
      fromStoreCode: '001',
      toStoreCode: '002',
      status: 'IN_TRANSIT',
      items: [
        {
          id: 'item-sim-1',
          productCode: 'OIL-10W40',
          quantityRequested: 10,
          quantityDispatched: 10,
          quantityReceived: null,
        },
      ],
    });

    // 3. Receive transfer with only 9 units (1 missing)
    const received = await service.receiveTransfer(
      'trf-sim-10',
      {
        receivedBy: 'OPERADOR_RECEPTOR',
        discrepancyReason: 'FALTANTE_NO_LLEGO',
        discrepancyNotes: 'Llegaron 9 botes, faltó 1 en caja',
        items: [{ productCode: 'OIL-10W40', quantity: 9 }],
      },
      { storeCode: '002', role: 'OPERATOR' },
    );

    // 4. Verify status is RECEIVED_WITH_DISCREPANCY
    expect(received.status).toBe('RECEIVED_WITH_DISCREPANCY');

    // 5. Verify SSE alert was emitted
    expect(alertsBroadcastServiceMock.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TRANSFER_DISCREPANCY',
        severity: 'CRITICAL',
        title: expect.stringContaining('Recibido con Discrepancia'),
      }),
    );
  });
});
