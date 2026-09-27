import { Test, TestingModule } from '@nestjs/testing';
import { EtlController } from './etl.controller';
import { EtlService } from './etl.service';

import { EtlCronTask } from './infrastructure/tasks/etl-cron.task';
import { ETL_USE_CASE } from './etl.tokens';

describe('EtlController', () => {
  let controller: EtlController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EtlController],
      providers: [
        EtlService,
        { provide: ETL_USE_CASE, useExisting: EtlService },
        {
          provide: EtlCronTask,
          useValue: {
            getStatus: jest.fn().mockReturnValue({ isRunning: false, lastRun: null }),
          },
        },
        { provide: 'IConnectionFactory', useValue: { getTpvConnection: () => null, getFusionConnection: () => null } },
        { provide: 'EtlLockRepository', useValue: { acquireLock: () => true, releaseLock: () => {}, isLocked: () => false, waitForStoreLock: () => true } },
        { provide: 'EtlSyncRepository', useValue: { getHoseConfiguration: () => ({ hoseMap: {}, productMap: {} }), syncHoses: () => {}, syncTpvShifts: () => {}, syncSaleHeaders: () => {}, syncTpvSales: () => {}, syncPaymentMethods: () => {}, updateShiftTotals: () => {} } },
        { provide: 'StoreRepository', useValue: { findByCode: () => null } },
        { provide: 'IAuditUseCase', useValue: { record: () => Promise.resolve() } },
      ],
    }).compile();

    controller = module.get<EtlController>(EtlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
