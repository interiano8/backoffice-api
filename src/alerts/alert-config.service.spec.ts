import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlertConfigService } from './alert-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('AlertConfigService', () => {
  let service: AlertConfigService;
  let prismaMock: {
    boAlertConfig: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };
  let configServiceMock: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      boAlertConfig: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    configServiceMock = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertConfigService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<AlertConfigService>(AlertConfigService);
  });

  describe('getConfig', () => {
    it('debe retornar la configuración almacenada en BD si existe un registro', async () => {
      const mockRecord = {
        id: 'cfg-1',
        recipientEmails: 'admin@prisma.hn, auditoria@prisma.hn',
        cashVarianceThreshold: new Prisma.Decimal(100.5),
        alertsEnabled: true,
        shiftDiscrepancyEnabled: false,
        fiscalGapEnabled: true,
        offlineStoreEnabled: true,
        offlineMinutesThreshold: 20,
        cooldownMinutes: 45,
        updatedAt: new Date('2026-09-25T10:00:00Z'),
      };
      prismaMock.boAlertConfig.findFirst.mockResolvedValue(mockRecord);

      const result = await service.getConfig();

      expect(result).toEqual({
        recipientEmails: ['admin@prisma.hn', 'auditoria@prisma.hn'],
        cashVarianceThreshold: 100.5,
        alertsEnabled: true,
        shiftDiscrepancyEnabled: false,
        fiscalGapEnabled: true,
        offlineStoreEnabled: true,
        offlineMinutesThreshold: 20,
        cooldownMinutes: 45,
        updatedAt: mockRecord.updatedAt,
      });
      expect(prismaMock.boAlertConfig.findFirst).toHaveBeenCalledWith({
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('debe retornar configuración por defecto con fallback a variables de entorno si la BD está vacía', async () => {
      prismaMock.boAlertConfig.findFirst.mockResolvedValue(null);
      configServiceMock.get.mockImplementation((key: string) => {
        if (key === 'ALERT_RECIPIENT_EMAILS') return 'ops@prisma.hn; alert@prisma.hn';
        if (key === 'ALERT_CASH_VARIANCE_THRESHOLD') return '75.0';
        return null;
      });

      const result = await service.getConfig();

      expect(result.recipientEmails).toEqual(['ops@prisma.hn', 'alert@prisma.hn']);
      expect(result.cashVarianceThreshold).toBe(75.0);
      expect(result.alertsEnabled).toBe(true);
      expect(result.shiftDiscrepancyEnabled).toBe(true);
      expect(result.fiscalGapEnabled).toBe(true);
      expect(result.offlineStoreEnabled).toBe(true);
      expect(result.offlineMinutesThreshold).toBe(15);
      expect(result.cooldownMinutes).toBe(60);
    });

    it('debe recuperarse de un error de base de datos retornando la configuración por defecto', async () => {
      prismaMock.boAlertConfig.findFirst.mockRejectedValue(new Error('Connection lost'));
      configServiceMock.get.mockReturnValue(null);

      const result = await service.getConfig();

      expect(result.cashVarianceThreshold).toBe(50.0);
      expect(result.recipientEmails).toEqual([]);
      expect(result.alertsEnabled).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('debe actualizar un registro existente en la base de datos', async () => {
      const existing = {
        id: 'cfg-1',
        recipientEmails: 'old@prisma.hn',
        cashVarianceThreshold: new Prisma.Decimal(50.0),
        alertsEnabled: true,
        shiftDiscrepancyEnabled: true,
        fiscalGapEnabled: true,
        offlineStoreEnabled: true,
        offlineMinutesThreshold: 15,
        cooldownMinutes: 60,
        updatedAt: new Date(),
      };
      prismaMock.boAlertConfig.findFirst.mockResolvedValue(existing);

      const updatedDate = new Date();
      prismaMock.boAlertConfig.update.mockResolvedValue({
        id: 'cfg-1',
        recipientEmails: 'new@prisma.hn, security@prisma.hn',
        cashVarianceThreshold: new Prisma.Decimal(120.0),
        alertsEnabled: true,
        shiftDiscrepancyEnabled: false,
        fiscalGapEnabled: true,
        offlineStoreEnabled: true,
        offlineMinutesThreshold: 30,
        cooldownMinutes: 60,
        updatedAt: updatedDate,
      });

      const result = await service.updateConfig({
        recipientEmails: ['new@prisma.hn', 'security@prisma.hn'],
        cashVarianceThreshold: 120.0,
        shiftDiscrepancyEnabled: false,
        offlineMinutesThreshold: 30,
      });

      expect(prismaMock.boAlertConfig.update).toHaveBeenCalledWith({
        where: { id: 'cfg-1' },
        data: expect.objectContaining({
          recipientEmails: 'new@prisma.hn, security@prisma.hn',
          shiftDiscrepancyEnabled: false,
          offlineMinutesThreshold: 30,
        }),
      });
      expect(result.recipientEmails).toEqual(['new@prisma.hn', 'security@prisma.hn']);
      expect(result.cashVarianceThreshold).toBe(120.0);
      expect(result.shiftDiscrepancyEnabled).toBe(false);
    });

    it('debe crear un nuevo registro si no existía ninguno previamente', async () => {
      prismaMock.boAlertConfig.findFirst.mockResolvedValue(null);
      configServiceMock.get.mockReturnValue(null);

      const newDate = new Date();
      prismaMock.boAlertConfig.create.mockResolvedValue({
        id: 'new-uuid',
        recipientEmails: 'auditor@prisma.hn',
        cashVarianceThreshold: new Prisma.Decimal(80.0),
        alertsEnabled: false,
        shiftDiscrepancyEnabled: true,
        fiscalGapEnabled: true,
        offlineStoreEnabled: true,
        offlineMinutesThreshold: 15,
        cooldownMinutes: 60,
        updatedAt: newDate,
      });

      const result = await service.updateConfig({
        recipientEmails: 'auditor@prisma.hn',
        cashVarianceThreshold: 80.0,
        alertsEnabled: false,
      });

      expect(prismaMock.boAlertConfig.create).toHaveBeenCalled();
      expect(result.recipientEmails).toEqual(['auditor@prisma.hn']);
      expect(result.alertsEnabled).toBe(false);
    });

    it('debe rechazar con BadRequestException si se ingresa un correo con formato inválido', async () => {
      prismaMock.boAlertConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.updateConfig({
          recipientEmails: 'correo-invalido-sin-arroba',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
