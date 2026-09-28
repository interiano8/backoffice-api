import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('SyncService & SyncController', () => {
  let service: SyncService;
  let controller: SyncController;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      boSaleHeader: {
        upsert: jest.fn().mockResolvedValue({ id: 'header-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      boSale: {
        upsert: jest.fn().mockResolvedValue({ id: 'line-1' }),
      },
      boPaymentMethod: {
        upsert: jest.fn().mockResolvedValue({ id: 'pay-1' }),
      },
      boShift: {
        upsert: jest.fn().mockResolvedValue({ id: 'shift-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'shift-1' }),
      },
      boStore: {
        upsert: jest.fn().mockResolvedValue({ id: 'store-1', code: '001' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'store-1', code: '001' }),
      },
      boHose: {
        findMany: jest.fn().mockResolvedValue([
          {
            gradeId: 1,
            gradeName: 'SUPER',
            unitPrice: 32.5,
            updatedAt: new Date('2026-09-25T10:00:00Z'),
          },
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [
        SyncService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    controller = module.get<SyncController>(SyncController);
  });

  describe('SyncService.syncUp', () => {
    it('procesa lote de ventas y actualiza boStore', async () => {
      const payload = {
        storeCode: '001',
        sentAt: '2026-09-25T13:00:00Z',
        sales: [
          {
            transactionId: 'TX-100',
            docType: 1,
            docNo: '001-001-01-00000001',
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Juan Pérez',
            subTotal: 100,
            totalAmount: 115,
            lines: [
              {
                lineNo: 1,
                externalId: 'EXT-1',
                timestamp: '2026-09-25T13:00:00Z',
                amount: 115,
                unitPrice: 32.5,
                volume: 3.538,
                productName: 'SUPER',
              },
            ],
            payments: [
              {
                chargeLineNo: 1,
                chargeMethodCode: '1002',
                description: 'EFECTIVO',
                amount: 115,
              },
            ],
          },
        ],
        shifts: [
          {
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Juan Pérez',
            startTime: '2026-09-25T08:00:00Z',
            status: 'OPEN',
            totalSale: 115,
            totalDiscount: 0,
          },
        ],
      };

      const result = await service.syncUp(payload as any);

      expect(result.success).toBe(true);
      expect(result.processedSales).toBe(1);
      expect(result.confirmedTransactionIds).toEqual(['TX-100']);
      expect(prismaMock.boSaleHeader.upsert).toHaveBeenCalledTimes(1);
      expect(prismaMock.boSale.upsert).toHaveBeenCalledTimes(1);
      expect(prismaMock.boPaymentMethod.upsert).toHaveBeenCalledTimes(1);
      expect(prismaMock.boShift.upsert).toHaveBeenCalledTimes(1);
      expect(prismaMock.boStore.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: '001' },
          update: expect.objectContaining({ healthStatus: 'ONLINE' }),
        }),
      );
    });

    it('arroja BadRequestException si no se especifica storeCode', async () => {
      await expect(service.syncUp({ storeCode: '' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza venta y no la confirma si la suma de líneas no coincide con el total', async () => {
      const payload = {
        storeCode: '001',
        sentAt: '2026-09-25T13:00:00Z',
        sales: [
          {
            transactionId: 'TX-BAD-LINES',
            docType: 1,
            docNo: '001-001-01-00000002',
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Juan Pérez',
            subTotal: 100,
            totalAmount: 115,
            lines: [{ lineNo: 1, externalId: 'L1', timestamp: '2026-09-25T13:00:00Z', amount: 80 }],
            payments: [{ chargeLineNo: 1, chargeMethodCode: '1002', description: 'EFECTIVO', amount: 115 }],
          },
        ],
      };

      const result = await service.syncUp(payload as any);
      expect(result.processedSales).toBe(0);
      expect(result.confirmedTransactionIds).not.toContain('TX-BAD-LINES');
      expect(prismaMock.boSaleHeader.upsert).not.toHaveBeenCalled();
    });

    it('rechaza venta si la suma de pagos no coincide con el total', async () => {
      const payload = {
        storeCode: '001',
        sentAt: '2026-09-25T13:00:00Z',
        sales: [
          {
            transactionId: 'TX-BAD-PAY',
            docType: 1,
            docNo: '001-001-01-00000003',
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Juan Pérez',
            subTotal: 100,
            totalAmount: 115,
            lines: [{ lineNo: 1, externalId: 'L1', timestamp: '2026-09-25T13:00:00Z', amount: 115 }],
            payments: [{ chargeLineNo: 1, chargeMethodCode: '1002', description: 'EFECTIVO', amount: 100 }],
          },
        ],
      };

      const result = await service.syncUp(payload as any);
      expect(result.processedSales).toBe(0);
      expect(result.confirmedTransactionIds).not.toContain('TX-BAD-PAY');
      expect(prismaMock.boSaleHeader.upsert).not.toHaveBeenCalled();
    });

    it('ejecuta la persistencia atómica en prisma.$transaction', async () => {
      const payload = {
        storeCode: '001',
        sentAt: '2026-09-25T13:00:00Z',
        sales: [
          {
            transactionId: 'TX-ATOMIC',
            docType: 1,
            docNo: '001-001-01-00000004',
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Juan Pérez',
            subTotal: 100,
            totalAmount: 115,
            lines: [{ lineNo: 1, externalId: 'L1', timestamp: '2026-09-25T13:00:00Z', amount: 115 }],
            payments: [{ chargeLineNo: 1, chargeMethodCode: '1002', description: 'EFECTIVO', amount: 115 }],
          },
        ],
      };

      const result = await service.syncUp(payload as any);
      expect(result.processedSales).toBe(1);
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('marca turno abierto como OPEN_OPERATIONAL sin calcular cuadre', async () => {
      const payload = {
        storeCode: '001',
        sentAt: '2026-09-25T13:00:00Z',
        shifts: [
          {
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Juan Pérez',
            startTime: '2026-09-25T08:00:00Z',
            status: 'OPEN',
            totalSale: 500,
            totalDiscount: 0,
            cashDeclared: 200,
          },
        ],
      };

      await service.syncUp(payload as any);
      expect(prismaMock.boShift.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            auditStatus: 'OPEN_OPERATIONAL',
            isBalanced: false,
            cashVariance: null,
          }),
        }),
      );
    });

    it('marca turno cerrado en SYNC_IN_PROGRESS si faltan ventas por sincronizar', async () => {
      prismaMock.boSaleHeader.findMany.mockResolvedValueOnce([
        { totalAmount: 100 },
      ]); // Solo 1 venta en BD, pero el turno declara 2

      const payload = {
        storeCode: '001',
        sentAt: '2026-09-25T13:00:00Z',
        shifts: [
          {
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Juan Pérez',
            startTime: '2026-09-25T08:00:00Z',
            endTime: '2026-09-25T16:00:00Z',
            status: 'CLOSED',
            totalSale: 200,
            totalDiscount: 0,
            cashDeclared: 200,
            controlTotals: {
              totalSalesCount: 2,
              totalSalesAmount: 200,
            },
          },
        ],
      };

      await service.syncUp(payload as any);
      expect(prismaMock.boShift.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            auditStatus: 'SYNC_IN_PROGRESS',
            isBalanced: false,
            cashVariance: null,
          }),
        }),
      );
    });

    it('marca turno cerrado como BALANCED cuando todas las ventas están sincronizadas y el efectivo cuadra', async () => {
      prismaMock.boSaleHeader.findMany.mockResolvedValueOnce([
        { totalAmount: 100 },
        { totalAmount: 100 },
      ]); // 2 ventas en BD = 200 total

      const payload = {
        storeCode: '001',
        sentAt: '2026-09-25T13:00:00Z',
        shifts: [
          {
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Juan Pérez',
            startTime: '2026-09-25T08:00:00Z',
            endTime: '2026-09-25T16:00:00Z',
            status: 'CLOSED',
            totalSale: 200,
            totalDiscount: 0,
            cashDeclared: 200,
            controlTotals: {
              totalSalesCount: 2,
              totalSalesAmount: 200,
            },
          },
        ],
      };

      await service.syncUp(payload as any);
      expect(prismaMock.boShift.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            auditStatus: 'BALANCED',
            isBalanced: true,
            cashVariance: 0,
          }),
        }),
      );
    });

    it('marca turno cerrado como DISCREPANCY cuando hay faltante de dinero', async () => {
      prismaMock.boSaleHeader.findMany.mockResolvedValueOnce([
        { totalAmount: 100 },
        { totalAmount: 100 },
      ]); // Ventas = 200, Declaró = 180 -> Faltante = -20

      const payload = {
        storeCode: '001',
        sentAt: '2026-09-25T13:00:00Z',
        shifts: [
          {
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Juan Pérez',
            startTime: '2026-09-25T08:00:00Z',
            endTime: '2026-09-25T16:00:00Z',
            status: 'CLOSED',
            totalSale: 200,
            totalDiscount: 0,
            cashDeclared: 180,
            controlTotals: {
              totalSalesCount: 2,
              totalSalesAmount: 200,
            },
          },
        ],
      };

      await service.syncUp(payload as any);
      expect(prismaMock.boShift.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            auditStatus: 'DISCREPANCY',
            isBalanced: false,
            cashVariance: -20,
          }),
        }),
      );
    });

    it('re-evalúa turno en SYNC_IN_PROGRESS tras la llegada de la última venta pendiente', async () => {
      prismaMock.boShift.findUnique.mockResolvedValueOnce({
        id: 'shift-123',
        auditStatus: 'SYNC_IN_PROGRESS',
        cashDeclared: 200,
        cardDeclared: 0,
        otherDeclared: 0,
        presentationDetails: JSON.stringify({ expectedCount: 2 }),
      });
      // Tras la venta, ahora hay 2 ventas en BD
      prismaMock.boSaleHeader.findMany.mockResolvedValueOnce([
        { totalAmount: 100 },
        { totalAmount: 100 },
      ]);

      const payload = {
        storeCode: '001',
        sentAt: '2026-09-25T13:00:00Z',
        sales: [
          {
            transactionId: 'TX-SECOND',
            docType: 1,
            docNo: '001-001-01-00000005',
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Juan Pérez',
            subTotal: 100,
            totalAmount: 100,
            lines: [{ lineNo: 1, externalId: 'L2', timestamp: '2026-09-25T13:00:00Z', amount: 100 }],
            payments: [{ chargeLineNo: 1, chargeMethodCode: '1002', description: 'EFECTIVO', amount: 100 }],
          },
        ],
      };

      await service.syncUp(payload as any);
      expect(prismaMock.boShift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shift-123' },
          data: expect.objectContaining({
            auditStatus: 'BALANCED',
            isBalanced: true,
            cashVariance: 0,
          }),
        }),
      );
    });
  });

  describe('SyncService.getMasters', () => {
    it('devuelve versión de catálogo y precios de combustible de la estación', async () => {
      const result = await service.getMasters('001', 0);
      expect(result.masterVersion).toBeGreaterThan(0);
      expect(result.hasUpdates).toBe(true);
      expect(result.fuelPrices).toHaveLength(1);
      expect(result.fuelPrices[0].gradeName).toBe('SUPER');
      expect(result.fuelPrices[0].unitPrice).toBe(32.5);
    });

    it('devuelve hasUpdates: false si la estación ya tiene la versión actual', async () => {
      const futureVersion = Math.floor(Date.now() / 60000) + 10;
      const result = await service.getMasters('001', futureVersion);
      expect(result.hasUpdates).toBe(false);
      expect(result.fuelPrices).toHaveLength(0);
      expect(result.users).toHaveLength(0);
    });

    it('incluye usuarios en el payload maestro cuando hay actualizaciones', async () => {
      prismaMock.user.findMany.mockResolvedValueOnce([
        {
          username: 'cajero1',
          name: 'Cajero Uno',
          password: 'hashed-password-123',
          role: 'OPERATOR',
          isActive: true,
        },
      ]);

      const result = await service.getMasters('001', 0);
      expect(result.users).toHaveLength(1);
      expect(result.users[0].username).toBe('cajero1');
      expect(result.users[0].name).toBe('Cajero Uno');
      expect(result.users[0].passwordHash).toBe('hashed-password-123');
      expect(result.users[0].role).toBe('OPERATOR');
      expect(result.users[0].active).toBe(true);
    });

    it('incrementa masterVersion al invocar bumpMasterVersion()', async () => {
      const v1 = service.getMasterVersion();
      const v2 = service.bumpMasterVersion();
      expect(v2).toBe(v1 + 1);
    });
  });

  describe('SyncService.ping', () => {
    it('actualiza estado a ONLINE y responde pong', async () => {
      const result = await service.ping('001', 5);
      expect(result.status).toBe('pong');
      expect(result.queueCount).toBe(5);
      expect(prismaMock.boStore.upsert).toHaveBeenCalled();
    });
  });

  describe('SyncController', () => {
    it('permite la ejecución si la clave de sincronización coincide', async () => {
      process.env.SYNC_API_KEY = 'test-secret';
      const spy = jest.spyOn(service, 'ping').mockResolvedValue({ status: 'pong' } as any);

      const res = await controller.ping({ storeCode: '001' }, 'test-secret');
      expect(res.status).toBe('pong');
      expect(spy).toHaveBeenCalled();
      delete process.env.SYNC_API_KEY;
    });

    it('lanza UnauthorizedException si la clave de sincronización no coincide', async () => {
      process.env.SYNC_API_KEY = 'test-secret';
      await expect(
        controller.ping({ storeCode: '001' }, 'wrong-secret'),
      ).rejects.toThrow(UnauthorizedException);
      delete process.env.SYNC_API_KEY;
    });
  });

  describe('SyncService - Alertas de Descuadre de Turno', () => {
    let alertConfigMock: any;
    let brevoMock: any;
    let serviceWithAlerts: SyncService;

    beforeEach(() => {
      alertConfigMock = {
        getConfig: jest.fn().mockResolvedValue({
          recipientEmails: ['auditor@prisma.hn'],
          cashVarianceThreshold: 50.0,
          alertsEnabled: true,
          shiftDiscrepancyEnabled: true,
          fiscalGapEnabled: true,
          offlineStoreEnabled: true,
          offlineMinutesThreshold: 15,
          cooldownMinutes: 60,
        }),
      };

      brevoMock = {
        sendEmail: jest.fn().mockResolvedValue({ success: true }),
      };

      serviceWithAlerts = new SyncService(prismaMock, alertConfigMock, brevoMock);
    });

    it('debe disparar alerta por correo si el descuadre supera o iguala el umbral configurado en BD', async () => {
      await serviceWithAlerts.syncUp({
        storeCode: '001',
        sentAt: '2026-09-25T14:00:00Z',
        sales: [],
        shifts: [
          {
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Carlos M',
            startTime: '2026-09-25T06:00:00Z',
            endTime: '2026-09-25T14:00:00Z',
            status: 'CLOSED',
            totalSale: 1000,
            totalDiscount: 0,
            cashDeclared: 900,
          },
        ],
      });

      expect(brevoMock.sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = brevoMock.sendEmail.mock.calls[0][0];
      expect(emailArgs.to).toEqual(['auditor@prisma.hn']);
      expect(emailArgs.subject).toContain('[ALERTA] Descuadre en Turno - Estación 001');
      expect(emailArgs.htmlContent).toContain('L. -100.00');
    });

    it('no debe disparar alerta si el descuadre es inferior al umbral configurado en BD', async () => {
      await serviceWithAlerts.syncUp({
        storeCode: '001',
        sentAt: '2026-09-25T14:00:00Z',
        sales: [],
        shifts: [
          {
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Carlos M',
            startTime: '2026-09-25T06:00:00Z',
            endTime: '2026-09-25T14:00:00Z',
            status: 'CLOSED',
            totalSale: 1000,
            totalDiscount: 0,
            cashDeclared: 980,
          },
        ],
      });

      expect(brevoMock.sendEmail).not.toHaveBeenCalled();
    });

    it('no debe disparar alerta si shiftDiscrepancyEnabled está desactivado en BD', async () => {
      alertConfigMock.getConfig.mockResolvedValueOnce({
        recipientEmails: ['auditor@prisma.hn'],
        cashVarianceThreshold: 50.0,
        alertsEnabled: true,
        shiftDiscrepancyEnabled: false,
      });

      await serviceWithAlerts.syncUp({
        storeCode: '001',
        sentAt: '2026-09-25T14:00:00Z',
        sales: [],
        shifts: [
          {
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Carlos M',
            startTime: '2026-09-25T06:00:00Z',
            endTime: '2026-09-25T14:00:00Z',
            status: 'CLOSED',
            totalSale: 1000,
            totalDiscount: 0,
            cashDeclared: 800,
          },
        ],
      });

      expect(brevoMock.sendEmail).not.toHaveBeenCalled();
    });

    it('no debe disparar alerta si el conmutador general alertsEnabled está desactivado en BD', async () => {
      alertConfigMock.getConfig.mockResolvedValueOnce({
        recipientEmails: ['auditor@prisma.hn'],
        cashVarianceThreshold: 50.0,
        alertsEnabled: false,
        shiftDiscrepancyEnabled: true,
      });

      await serviceWithAlerts.syncUp({
        storeCode: '001',
        sentAt: '2026-09-25T14:00:00Z',
        sales: [],
        shifts: [
          {
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Carlos M',
            startTime: '2026-09-25T06:00:00Z',
            endTime: '2026-09-25T14:00:00Z',
            status: 'CLOSED',
            totalSale: 1000,
            totalDiscount: 0,
            cashDeclared: 800,
          },
        ],
      });

      expect(brevoMock.sendEmail).not.toHaveBeenCalled();
    });

    it('debe continuar la sincronización exitosamente incluso si Brevo falla o rechaza el envío (resiliencia)', async () => {
      brevoMock.sendEmail.mockRejectedValueOnce(new Error('Brevo service 503 unavailable'));

      const result = await serviceWithAlerts.syncUp({
        storeCode: '001',
        sentAt: '2026-09-25T14:00:00Z',
        sales: [],
        shifts: [
          {
            shiftDate: '2026-09-25',
            shiftNo: '1',
            employeeName: 'Carlos M',
            startTime: '2026-09-25T06:00:00Z',
            endTime: '2026-09-25T14:00:00Z',
            status: 'CLOSED',
            totalSale: 1000,
            totalDiscount: 0,
            cashDeclared: 800,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(brevoMock.sendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('SyncService.getStoreConfig & SyncController.getStoreConfig', () => {
    it('retorna snapshot completo de configuracion de tienda, POS y mangueras', async () => {
      prismaMock.boStore.findUnique.mockResolvedValueOnce({
        id: 'store-1',
        code: '002',
        name: 'Estación Norte',
        RTN: '08011999123456',
        emisor: 'ESTACION NORTE S.A.',
        titulo: 'GASOLINERA NORTE',
        address: 'Blvd del Norte, SPS',
        telefono: '2550-1234',
        correo: 'norte@prisma.hn',
        ipFusion: '192.168.1.100',
        urlControlador: 'http://192.168.1.100:5008',
        claveControlador: 'SECRET-WAYNE',
        esControladorGas: false,
        moneda: 'HNL',
        codigoMoneda: 'HNL',
        configVersion: 3,
        posConfig: {
          codigoPos: '01',
          pantallaEnBomba: true,
          bloquearSoloPos: false,
          mostrarBombas: true,
        },
      });

      prismaMock.boHose.findMany.mockResolvedValueOnce([
        {
          pumpId: 1,
          hoseId: 1,
          hosePhysicalId: 1,
          gradeId: 1,
          gradeName: 'SUPER',
          unitPrice: 32.5,
          tankId: '1',
          posCode: '1',
          genericCode: '1',
          active: true,
          unitOfMeasure: 'GL',
        },
        {
          pumpId: 1,
          hoseId: 2,
          hosePhysicalId: 2,
          gradeId: 2,
          gradeName: 'REGULAR',
          unitPrice: 29.8,
          tankId: '2',
          posCode: '1',
          genericCode: '2',
          active: true,
          unitOfMeasure: 'GL',
        },
      ]);

      const config = await service.getStoreConfig('002');
      expect(config.storeCode).toBe('002');
      expect(config.configVersion).toBe(3);
      expect(config.tienda.nombre).toBe('Estación Norte');
      expect(config.tienda.ipFusion).toBe('192.168.1.100');
      expect(config.tienda.claveControlador).toBe('SECRET-WAYNE');
      expect(config.configuracionPos.pantallaEnBomba).toBe(true);
      expect(config.mangueras).toHaveLength(2);
      expect(config.mangueras[0].nombreGrado).toBe('SUPER');
      expect(config.mangueras[0].precioUnitario).toBe(32.5);
    });

    it('lanza BadRequestException si storeCode esta vacio', async () => {
      await expect(service.getStoreConfig('')).rejects.toThrow(BadRequestException);
      await expect(service.getStoreConfig('   ')).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la tienda no existe en Matriz', async () => {
      prismaMock.boStore.findUnique.mockResolvedValueOnce(null);
      await expect(service.getStoreConfig('999')).rejects.toThrow(
        /Tienda con código '999' no encontrada en la Matriz/,
      );
    });

    it('SyncController.getStoreConfig valida x-sync-key y retorna configuracion', async () => {
      prismaMock.boStore.findUnique.mockResolvedValueOnce({
        id: 'store-1',
        code: '001',
        name: 'Estación Central',
        configVersion: 1,
      });
      prismaMock.boHose.findMany.mockResolvedValueOnce([]);

      const result = await controller.getStoreConfig('001', 'prisma-cloud-sync-key');
      expect(result.storeCode).toBe('001');
      expect(result.configVersion).toBe(1);
    });

    it('SyncController.getStoreConfig rechaza x-sync-key invalida con UnauthorizedException', async () => {
      const origKey = process.env.SYNC_API_KEY;
      try {
        process.env.SYNC_API_KEY = 'clave-secreta-fuerte';
        await expect(controller.getStoreConfig('001', 'clave-invalida')).rejects.toThrow(
          UnauthorizedException,
        );
      } finally {
        process.env.SYNC_API_KEY = origKey;
      }
    });
  });
});
