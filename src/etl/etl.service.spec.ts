import { Test, TestingModule } from '@nestjs/testing';
import { EtlService } from './etl.service';

describe('EtlService', () => {
  let service: EtlService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtlService,
        { provide: 'IConnectionFactory', useValue: { getTpvConnection: () => null, getFusionConnection: () => null } },
        { provide: 'EtlLockRepository', useValue: { acquireLock: () => true, releaseLock: () => {}, isLocked: () => false, waitForStoreLock: () => true } },
        { provide: 'EtlSyncRepository', useValue: { getHoseConfiguration: () => ({ hoseMap: {}, productMap: {} }), syncHoses: () => {}, syncTpvShifts: () => {}, syncSaleHeaders: () => {}, syncTpvSales: () => {}, syncPaymentMethods: () => {}, updateShiftTotals: () => {} } },
        { provide: 'StoreRepository', useValue: { findByCode: () => null } },
        { provide: 'IAuditUseCase', useValue: { record: () => Promise.resolve() } },
      ],
    }).compile();

    service = module.get<EtlService>(EtlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
