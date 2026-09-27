import { Test, TestingModule } from '@nestjs/testing';
import { FiscalAuditService } from './fiscal-audit.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('FiscalAuditService', () => {
  let service: FiscalAuditService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      boSaleHeader: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiscalAuditService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<FiscalAuditService>(FiscalAuditService);
  });

  describe('analyzeSequences', () => {
    it('reporta 0 huecos cuando la secuencia de correlativos es estrictamente contigua', () => {
      const records = [
        { storeCode: '001', docNo: '000-001-01-00000001' },
        { storeCode: '001', docNo: '000-001-01-00000002' },
        { storeCode: '001', docNo: '000-001-01-00000003' },
      ];

      const report = service.analyzeSequences(records);
      expect(report.totalInvoicesScanned).toBe(3);
      expect(report.hasGaps).toBe(false);
      expect(report.totalGapsDetected).toBe(0);
      expect(report.totalMissingInvoices).toBe(0);
      expect(report.gaps).toHaveLength(0);
    });

    it('detecta un salto de 1 número faltante', () => {
      const records = [
        { storeCode: '001', docNo: '000-001-01-00000001' },
        { storeCode: '001', docNo: '000-001-01-00000003' }, // Falta 00000002
      ];

      const report = service.analyzeSequences(records);
      expect(report.totalInvoicesScanned).toBe(2);
      expect(report.hasGaps).toBe(true);
      expect(report.totalGapsDetected).toBe(1);
      expect(report.totalMissingInvoices).toBe(1);
      expect(report.gaps[0]).toEqual({
        storeCode: '001',
        prefix: '000-001-01-',
        missingFrom: '000-001-01-00000002',
        missingTo: '000-001-01-00000002',
        missingCount: 1,
        missingDocNos: ['000-001-01-00000002'],
      });
    });

    it('detecta un rango múltiple de números faltantes', () => {
      const records = [
        { storeCode: '001', docNo: '000-001-01-00000010' },
        { storeCode: '001', docNo: '000-001-01-00000015' }, // Faltan 11, 12, 13, 14
      ];

      const report = service.analyzeSequences(records);
      expect(report.hasGaps).toBe(true);
      expect(report.totalGapsDetected).toBe(1);
      expect(report.totalMissingInvoices).toBe(4);
      expect(report.gaps[0].missingFrom).toBe('000-001-01-00000011');
      expect(report.gaps[0].missingTo).toBe('000-001-01-00000014');
      expect(report.gaps[0].missingDocNos).toEqual([
        '000-001-01-00000011',
        '000-001-01-00000012',
        '000-001-01-00000013',
        '000-001-01-00000014',
      ]);
    });

    it('separa secuencias por punto de emisión y por tienda de forma independiente', () => {
      const records = [
        // Tienda 001, POS 1
        { storeCode: '001', docNo: '000-001-01-00000001' },
        { storeCode: '001', docNo: '000-001-01-00000002' },
        // Tienda 001, POS 2 (con hueco)
        { storeCode: '001', docNo: '000-002-01-00000050' },
        { storeCode: '001', docNo: '000-002-01-00000052' },
        // Tienda 002, POS 1 (contigua)
        { storeCode: '002', docNo: '000-001-01-00000001' },
      ];

      const report = service.analyzeSequences(records);
      expect(report.totalGapsDetected).toBe(1);
      expect(report.gaps[0].storeCode).toBe('001');
      expect(report.gaps[0].prefix).toBe('000-002-01-');
      expect(report.gaps[0].missingFrom).toBe('000-002-01-00000051');
    });

    it('ignora documentos con formato no fiscal SAR sin romper el análisis', () => {
      const records = [
        { storeCode: '001', docNo: 'TICKET-123' },
        { storeCode: '001', docNo: '' },
        { storeCode: '001', docNo: '000-001-01-00000001' },
        { storeCode: '001', docNo: '000-001-01-00000002' },
      ];

      const report = service.analyzeSequences(records);
      expect(report.totalInvoicesScanned).toBe(2);
      expect(report.hasGaps).toBe(false);
    });
  });

  describe('detectFiscalGaps', () => {
    it('consulta la base de datos aplicando filtro de tienda si se proporciona', async () => {
      prismaMock.boSaleHeader.findMany.mockResolvedValueOnce([
        { storeCode: '001', docNo: '000-001-01-00000001' },
        { storeCode: '001', docNo: '000-001-01-00000002' },
      ]);

      const report = await service.detectFiscalGaps('001');
      expect(prismaMock.boSaleHeader.findMany).toHaveBeenCalledWith({
        where: { storeCode: '001' },
        select: { storeCode: true, docNo: true },
        orderBy: { docNo: 'asc' },
      });
      expect(report.hasGaps).toBe(false);
    });

    it('dispara alerta por correo a los destinatarios de BD cuando detecta saltos SAR', async () => {
      const alertConfigMock = {
        getConfig: jest.fn().mockResolvedValue({
          recipientEmails: ['sar-auditoria@prisma.hn'],
          alertsEnabled: true,
          fiscalGapEnabled: true,
        }),
      };
      const brevoMock = {
        sendEmail: jest.fn().mockResolvedValue({ success: true }),
      };

      const serviceWithAlerts = new FiscalAuditService(
        prismaMock,
        alertConfigMock as any,
        brevoMock as any,
      );

      prismaMock.boSaleHeader.findMany.mockResolvedValueOnce([
        { storeCode: '001', docNo: '000-001-01-00000001' },
        { storeCode: '001', docNo: '000-001-01-00000005' }, // 3 faltantes
      ]);

      const report = await serviceWithAlerts.detectFiscalGaps('001');
      expect(report.hasGaps).toBe(true);
      expect(brevoMock.sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = brevoMock.sendEmail.mock.calls[0][0];
      expect(emailArgs.to).toEqual(['sar-auditoria@prisma.hn']);
      expect(emailArgs.subject).toContain('[CRÍTICO] Salto de Correlativo Fiscal SAR - Estación 001');
      expect(emailArgs.htmlContent).toContain('3 factura(s)');
    });

    it('no dispara alerta si fiscalGapEnabled está desactivado en BD', async () => {
      const alertConfigMock = {
        getConfig: jest.fn().mockResolvedValue({
          recipientEmails: ['sar-auditoria@prisma.hn'],
          alertsEnabled: true,
          fiscalGapEnabled: false,
        }),
      };
      const brevoMock = {
        sendEmail: jest.fn().mockResolvedValue({ success: true }),
      };

      const serviceWithAlerts = new FiscalAuditService(
        prismaMock,
        alertConfigMock as any,
        brevoMock as any,
      );

      prismaMock.boSaleHeader.findMany.mockResolvedValueOnce([
        { storeCode: '001', docNo: '000-001-01-00000001' },
        { storeCode: '001', docNo: '000-001-01-00000005' },
      ]);

      const report = await serviceWithAlerts.detectFiscalGaps('001');
      expect(report.hasGaps).toBe(true);
      expect(brevoMock.sendEmail).not.toHaveBeenCalled();
    });
  });
});
