import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import {
  REPORTS_USE_CASE,
  CUSTOMER_STATEMENT_USE_CASE,
  DASHBOARD_USE_CASE,
} from './reports.tokens';

describe('ReportsController', () => {
  let controller: ReportsController;
  let reportsUseCaseMock: any;
  let customerStatementUseCaseMock: any;
  let dashboardUseCaseMock: any;

  beforeEach(async () => {
    reportsUseCaseMock = {
      getSalesDeclaration: jest.fn(),
    };
    customerStatementUseCaseMock = {
      getActiveCustomers: jest.fn(),
      getCustomerStatement: jest.fn(),
      getBulkCustomerStatements: jest.fn(),
    };
    dashboardUseCaseMock = {
      getDashboardStats: jest.fn(),
      getGlobalDashboardStats: jest.fn(),
      getMonthlyAnalysis: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: REPORTS_USE_CASE, useValue: reportsUseCaseMock },
        {
          provide: CUSTOMER_STATEMENT_USE_CASE,
          useValue: customerStatementUseCaseMock,
        },
        { provide: DASHBOARD_USE_CASE, useValue: dashboardUseCaseMock },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  describe('getDashboardStats', () => {
    it('debe invocar getGlobalDashboardStats si storeCode es GLOBAL', async () => {
      dashboardUseCaseMock.getGlobalDashboardStats.mockResolvedValue({
        totalAmount: 100,
      });

      const res = await controller.getDashboardStats(
        15,
        undefined,
        '2026-09-01',
        '2026-09-15',
        'GLOBAL',
      );

      expect(res).toEqual({ totalAmount: 100 });
      expect(dashboardUseCaseMock.getGlobalDashboardStats).toHaveBeenCalledWith(
        15,
        undefined,
        '2026-09-01',
        '2026-09-15',
      );
    });

    it('debe invocar getDashboardStats para una tienda individual', async () => {
      dashboardUseCaseMock.getDashboardStats.mockResolvedValue({
        totalAmount: 50,
      });

      const res = await controller.getDashboardStats(
        15,
        undefined,
        '2026-09-01',
        '2026-09-15',
        '001',
      );

      expect(res).toEqual({ totalAmount: 50 });
      expect(dashboardUseCaseMock.getDashboardStats).toHaveBeenCalledWith(
        '001',
        15,
        undefined,
        '2026-09-01',
        '2026-09-15',
      );
    });
  });

  describe('exportConsolidatedReport', () => {
    it('debe generar el contenido CSV estructurado con encabezados de descarga', async () => {
      dashboardUseCaseMock.getGlobalDashboardStats.mockResolvedValue({
        totalAmount: 154200.5,
        totalVolumeGL: 4520.12,
        totalTransactions: 1250,
        productVolumes: {
          SUPER: 2100.5,
          REGULAR: 1420.0,
          DIESEL: 999.62,
        },
        storeRankings: [
          {
            storeCode: '001',
            storeName: 'Estación Central',
            totalAmount: 90000.0,
            totalVolumeGL: 2600.0,
            transactionCount: 750,
          },
        ],
      });

      const resMock = {
        setHeader: jest.fn(),
      };

      const csv = await controller.exportConsolidatedReport(
        resMock,
        15,
        undefined,
        '2026-09-10',
        '2026-09-25',
      );

      expect(resMock.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8',
      );
      expect(resMock.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="reporte-consolidado-prisma-2026-09-10-2026-09-25.csv"'),
      );

      expect(csv).toContain('REPORTE CONSOLIDADO DE OPERACIONES - RED GLOBAL PRISMA');
      expect(csv).toContain('"154200.50","4520.12","1250"');
      expect(csv).toContain('"SUPER","2100.50"');
      expect(csv).toContain('"001","Estación Central","90000.00","2600.00","750"');
    });
  });
});
