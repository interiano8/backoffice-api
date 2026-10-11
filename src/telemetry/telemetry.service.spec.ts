import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsBroadcastService } from '../alerts/alerts-broadcast.service';
import { UnauthorizedException } from '@nestjs/common';

describe('TelemetryService & TelemetryController', () => {
  let service: TelemetryService;
  let controller: TelemetryController;
  let prismaMock: any;
  let alertsBroadcastMock: any;

  beforeEach(async () => {
    prismaMock = {
      boStore: {
        findMany: jest.fn().mockResolvedValue([
          { code: '001', name: 'Estación Central', lastSeenAt: new Date() },
          { code: '002', name: 'Estación Norte', lastSeenAt: null },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    alertsBroadcastMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelemetryController],
      providers: [
        TelemetryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AlertsBroadcastService, useValue: alertsBroadcastMock },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
    controller = module.get<TelemetryController>(TelemetryController);
  });

  it('should record a valid heartbeat and update lastSeenAt', async () => {
    const res = await service.recordHeartbeat({
      storeCode: '001',
      storeName: 'Estación Central',
      fusionStatus: 'ONLINE',
      pendingSyncCount: 0,
      posVersion: '1.2.0',
    });

    expect(res.success).toBe(true);
    expect(res.storeCode).toBe('001');
    expect(prismaMock.boStore.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: '001' } }),
    );
  });

  it('should classify stations correctly in getAllStatuses', async () => {
    await service.recordHeartbeat({
      storeCode: '001',
      fusionStatus: 'ONLINE',
      pendingSyncCount: 0,
    });

    const res = await service.getAllStatuses();
    expect(res.total).toBe(2);
    expect(res.online).toBe(1);
    expect(res.offline).toBe(1);

    const st1 = res.stations.find((s) => s.storeCode === '001');
    expect(st1?.status).toBe('ONLINE');

    const st2 = res.stations.find((s) => s.storeCode === '002');
    expect(st2?.status).toBe('OFFLINE');
  });

  it('should mark station as DEGRADED when fusionStatus is OFFLINE and emit alert', async () => {
    await service.recordHeartbeat({
      storeCode: '001',
      fusionStatus: 'OFFLINE',
      pendingSyncCount: 5,
    });

    expect(alertsBroadcastMock.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STATION_STATUS',
        severity: 'CRITICAL',
      }),
    );

    const res = await service.getAllStatuses();
    const st1 = res.stations.find((s) => s.storeCode === '001');
    expect(st1?.status).toBe('DEGRADED');
  });

  it('controller should reject heartbeat without valid sync key or bearer token', async () => {
    await expect(
      controller.recordHeartbeat({ storeCode: '001' }, 'wrong-key', undefined),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('controller should accept heartbeat with valid sync key', async () => {
    process.env.SYNC_API_KEY = 'prisma-cloud-sync-key';
    const res = await controller.recordHeartbeat(
      { storeCode: '001', fusionStatus: 'ONLINE' },
      'prisma-cloud-sync-key',
    );
    expect(res.success).toBe(true);
  });
});
