import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertConfigService } from './alert-config.service';
import { BrevoNotificationService } from './brevo-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { FiscalAuditService } from '../reconciliation/application/services/fiscal-audit.service';
import { BadRequestException } from '@nestjs/common';

describe('AlertsController', () => {
  let controller: AlertsController;
  let alertConfigServiceMock: {
    getConfig: jest.Mock;
    updateConfig: jest.Mock;
  };
  let brevoServiceMock: {
    sendEmail: jest.Mock;
  };
  let prismaMock: any;
  let fiscalAuditServiceMock: any;

  beforeEach(async () => {
    alertConfigServiceMock = {
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
    };
    brevoServiceMock = {
      sendEmail: jest.fn(),
    };
    prismaMock = {
      boShift: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      boStore: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    fiscalAuditServiceMock = {
      detectFiscalGaps: jest.fn().mockResolvedValue({ gaps: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        { provide: AlertConfigService, useValue: alertConfigServiceMock },
        { provide: BrevoNotificationService, useValue: brevoServiceMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: FiscalAuditService, useValue: fiscalAuditServiceMock },
      ],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
  });

  describe('getConfig', () => {
    it('debe retornar la configuración obtenida de AlertConfigService', async () => {
      const mockConfig = {
        recipientEmails: ['admin@prisma.hn'],
        cashVarianceThreshold: 50.0,
        alertsEnabled: true,
        shiftDiscrepancyEnabled: true,
        fiscalGapEnabled: true,
        offlineStoreEnabled: true,
        offlineMinutesThreshold: 15,
        cooldownMinutes: 60,
      };
      alertConfigServiceMock.getConfig.mockResolvedValue(mockConfig);

      const result = await controller.getConfig();
      expect(result).toEqual(mockConfig);
      expect(alertConfigServiceMock.getConfig).toHaveBeenCalled();
    });
  });

  describe('updateConfig', () => {
    it('debe enviar el payload a AlertConfigService y retornar la configuración actualizada', async () => {
      const updateDto = {
        recipientEmails: ['auditor@prisma.hn'],
        cashVarianceThreshold: 100.0,
        shiftDiscrepancyEnabled: false,
      };
      const updatedResponse = {
        ...updateDto,
        alertsEnabled: true,
        fiscalGapEnabled: true,
        offlineStoreEnabled: true,
        offlineMinutesThreshold: 15,
        cooldownMinutes: 60,
      };
      alertConfigServiceMock.updateConfig.mockResolvedValue(updatedResponse);

      const result = await controller.updateConfig(updateDto);
      expect(result).toEqual(updatedResponse);
      expect(alertConfigServiceMock.updateConfig).toHaveBeenCalledWith(updateDto);
    });
  });

  describe('sendTestAlert', () => {
    it('debe lanzar BadRequestException si la lista de destinatarios está vacía', async () => {
      alertConfigServiceMock.getConfig.mockResolvedValue({
        recipientEmails: [],
      });

      await expect(controller.sendTestAlert()).rejects.toThrow(BadRequestException);
      expect(brevoServiceMock.sendEmail).not.toHaveBeenCalled();
    });

    it('debe invocar a BrevoNotificationService con la plantilla de diagnóstico y retornar éxito', async () => {
      alertConfigServiceMock.getConfig.mockResolvedValue({
        recipientEmails: ['admin@prisma.hn'],
      });
      brevoServiceMock.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'test-msg-123',
      });

      const result = await controller.sendTestAlert();

      expect(brevoServiceMock.sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = brevoServiceMock.sendEmail.mock.calls[0][0];
      expect(emailArgs.to).toEqual(['admin@prisma.hn']);
      expect(emailArgs.subject).toContain('DIAGNÓSTICO');
      expect(result).toEqual({
        success: true,
        messageId: 'test-msg-123',
        simulated: undefined,
        recipients: ['admin@prisma.hn'],
        error: undefined,
      });
    });
  });

  describe('getRecentAlerts', () => {
    it('debe consolidar alertas de turnos descuadrados, saltos fiscales y tiendas desconectadas', async () => {
      alertConfigServiceMock.getConfig.mockResolvedValue({
        alertsEnabled: true,
        shiftDiscrepancyEnabled: true,
        fiscalGapEnabled: true,
        offlineStoreEnabled: true,
        cashVarianceThreshold: 50.0,
        offlineMinutesThreshold: 15,
      });

      // 1. Shift discrepancy
      prismaMock.boShift.findMany.mockResolvedValue([
        {
          id: 's-1',
          storeCode: '001',
          shiftNo: '2',
          employeeName: 'Maria R',
          cashVariance: -120.0, // >= 50 -> CRITICAL
          updatedAt: new Date('2026-09-25T14:00:00Z'),
        },
      ]);

      // 2. Fiscal gaps
      fiscalAuditServiceMock.detectFiscalGaps.mockResolvedValue({
        gaps: [
          {
            storeCode: '002',
            prefix: '000-001-01-',
            missingFrom: '000-001-01-00000010',
            missingTo: '000-001-01-00000012',
            missingCount: 3,
          },
        ],
      });

      // 3. Offline stores
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      prismaMock.boStore.findMany.mockResolvedValue([
        {
          code: '003',
          name: 'Estación Choluteca',
          isActive: true,
          lastSeenAt: thirtyMinAgo,
          updatedAt: thirtyMinAgo,
        },
      ]);

      const result = await controller.getRecentAlerts();

      expect(result.total).toBe(3);
      expect(result.criticalCount).toBe(2); // shift + fiscal
      expect(result.warningCount).toBe(1); // offline store
      expect(result.alerts).toHaveLength(3);
      expect(result.alerts[0].type).toBeDefined();
    });
  });
});
