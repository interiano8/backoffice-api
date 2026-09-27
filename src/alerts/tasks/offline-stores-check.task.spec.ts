import { Test, TestingModule } from '@nestjs/testing';
import { OfflineStoresCheckTask } from './offline-stores-check.task';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertConfigService } from '../alert-config.service';
import { BrevoNotificationService } from '../brevo-notification.service';

describe('OfflineStoresCheckTask', () => {
  let task: OfflineStoresCheckTask;
  let prismaMock: any;
  let alertConfigMock: any;
  let brevoMock: any;

  beforeEach(async () => {
    prismaMock = {
      boStore: {
        findMany: jest.fn(),
      },
    };

    alertConfigMock = {
      getConfig: jest.fn().mockResolvedValue({
        recipientEmails: ['admin@prisma.hn'],
        alertsEnabled: true,
        offlineStoreEnabled: true,
        offlineMinutesThreshold: 15,
        cooldownMinutes: 60,
      }),
    };

    brevoMock = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfflineStoresCheckTask,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AlertConfigService, useValue: alertConfigMock },
        { provide: BrevoNotificationService, useValue: brevoMock },
      ],
    }).compile();

    task = module.get<OfflineStoresCheckTask>(OfflineStoresCheckTask);
    task.clearCooldowns();
  });

  it('debe alertar cuando una estación activa no ha sido vista en más de offlineMinutesThreshold', async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    prismaMock.boStore.findMany.mockResolvedValue([
      {
        code: '005',
        name: 'Estación Comayagua',
        isActive: true,
        lastSeenAt: thirtyMinutesAgo,
      },
    ]);

    await task.checkOfflineStores();

    expect(brevoMock.sendEmail).toHaveBeenCalledTimes(1);
    const emailArgs = brevoMock.sendEmail.mock.calls[0][0];
    expect(emailArgs.to).toEqual(['admin@prisma.hn']);
    expect(emailArgs.subject).toContain('[ADVERTENCIA] Estación Desconectada - Estación Comayagua');
    expect(emailArgs.htmlContent).toContain('30 minutos');
  });

  it('no debe alertar si la estación ha sido vista recientemente dentro del umbral', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    prismaMock.boStore.findMany.mockResolvedValue([
      {
        code: '001',
        name: 'Estación Central',
        isActive: true,
        lastSeenAt: fiveMinutesAgo,
      },
    ]);

    await task.checkOfflineStores();

    expect(brevoMock.sendEmail).not.toHaveBeenCalled();
  });

  it('debe respetar el tiempo de enfriamiento (cooldown) y no repetir correos en ejecuciones consecutivas', async () => {
    const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000);
    prismaMock.boStore.findMany.mockResolvedValue([
      {
        code: '005',
        name: 'Estación Comayagua',
        isActive: true,
        lastSeenAt: fortyMinutesAgo,
      },
    ]);

    // Primera ejecución: debe enviar correo
    await task.checkOfflineStores();
    expect(brevoMock.sendEmail).toHaveBeenCalledTimes(1);

    // Segunda ejecución (ej. 5 minutos después mientras sigue caída): NO debe enviar correo por cooldown de 60m
    await task.checkOfflineStores();
    expect(brevoMock.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('no debe alertar si offlineStoreEnabled está desactivado en la BD', async () => {
    alertConfigMock.getConfig.mockResolvedValue({
      recipientEmails: ['admin@prisma.hn'],
      alertsEnabled: true,
      offlineStoreEnabled: false,
      offlineMinutesThreshold: 15,
      cooldownMinutes: 60,
    });

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    prismaMock.boStore.findMany.mockResolvedValue([
      {
        code: '005',
        name: 'Estación Comayagua',
        isActive: true,
        lastSeenAt: thirtyMinutesAgo,
      },
    ]);

    await task.checkOfflineStores();

    expect(brevoMock.sendEmail).not.toHaveBeenCalled();
  });
});
