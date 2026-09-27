import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationController } from './reconciliation.controller';
import { RECONCILIATION_USE_CASE } from './reconciliation.tokens';
import { FiscalAuditService } from './application/services/fiscal-audit.service';
import { PermissionsGuard } from '../auth/rbac/permissions.guard';
import { Reflector } from '@nestjs/core';

describe('ReconciliationController', () => {
  let controller: ReconciliationController;
  let useCaseMock: any;
  let fiscalAuditMock: any;

  beforeEach(async () => {
    useCaseMock = {
      createReconciliation: jest.fn(),
      getAll: jest.fn(),
      getById: jest.fn(),
    };

    fiscalAuditMock = {
      detectFiscalGaps: jest.fn().mockResolvedValue({
        storeCode: '001',
        totalInvoicesScanned: 10,
        totalGapsDetected: 0,
        totalMissingInvoices: 0,
        hasGaps: false,
        gaps: [],
        checkedAt: '2026-09-25T14:00:00Z',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReconciliationController],
      providers: [
        {
          provide: RECONCILIATION_USE_CASE,
          useValue: useCaseMock,
        },
        {
          provide: FiscalAuditService,
          useValue: fiscalAuditMock,
        },
        Reflector,
        {
          provide: PermissionsGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
      ],
    }).compile();

    controller = module.get<ReconciliationController>(ReconciliationController);
  });

  it('debe llamar a fiscalAuditService.detectFiscalGaps con storeCode', async () => {
    const result = await controller.getFiscalGaps('001');
    expect(fiscalAuditMock.detectFiscalGaps).toHaveBeenCalledWith('001');
    expect(result.hasGaps).toBe(false);
  });
});
