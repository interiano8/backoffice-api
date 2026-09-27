import { AlertTemplateBuilder } from './alert-template.builder';

describe('AlertTemplateBuilder', () => {
  it('debe generar la plantilla de descuadre de turno con formato, montos y asunto correctos', () => {
    const result = AlertTemplateBuilder.buildShiftDiscrepancyTemplate({
      storeCode: '001',
      shiftDate: '2026-09-25',
      shiftNo: '2',
      employeeName: 'Juan Perez',
      totalSale: 15420.5,
      cashDeclared: 15200.0,
      cashVariance: -220.5,
    });

    expect(result.subject).toBe('[ALERTA] Descuadre en Turno - Estación 001');
    expect(result.html).toContain('001');
    expect(result.html).toContain('Juan Perez');
    expect(result.html).toContain('L. 15420.50');
    expect(result.html).toContain('L. 15200.00');
    expect(result.html).toContain('L. -220.50');
    expect(result.html).toContain('badge-danger');
  });

  it('debe generar la plantilla de salto fiscal SAR con prefijo y rangos', () => {
    const result = AlertTemplateBuilder.buildFiscalGapTemplate({
      storeCode: '002',
      stationName: 'Estación Suyapa',
      prefix: '000-001-01',
      missingRanges: ['000-001-01-00001005 - 000-001-01-00001010'],
      missingCount: 6,
    });

    expect(result.subject).toBe('[CRÍTICO] Salto de Correlativo Fiscal SAR - Estación 002');
    expect(result.html).toContain('002');
    expect(result.html).toContain('Estación Suyapa');
    expect(result.html).toContain('000-001-01');
    expect(result.html).toContain('6 factura(s)');
    expect(result.html).toContain('000-001-01-00001005 - 000-001-01-00001010');
  });

  it('debe generar la plantilla de estación desconectada con minutos y última conexión', () => {
    const result = AlertTemplateBuilder.buildOfflineStoreTemplate({
      storeCode: '003',
      storeName: 'Estación Choluteca',
      minutesOffline: 45,
      lastSeenAt: '2026-09-25 18:30:00',
    });

    expect(result.subject).toBe('[ADVERTENCIA] Estación Desconectada - Estación Choluteca');
    expect(result.html).toContain('003');
    expect(result.html).toContain('Estación Choluteca');
    expect(result.html).toContain('45 minutos');
    expect(result.html).toContain('2026-09-25 18:30:00');
  });

  it('debe generar la plantilla de diagnóstico y prueba de sistema', () => {
    const result = AlertTemplateBuilder.buildTestTemplate({
      recipientEmails: ['admin@prisma.hn', 'soporte@prisma.hn'],
      timestamp: '2026-09-25 23:50:00',
    });

    expect(result.subject).toBe('[DIAGNÓSTICO] Verificación de Alertas - Prisma Hub Central');
    expect(result.html).toContain('OPERATIVO');
    expect(result.html).toContain('admin@prisma.hn');
    expect(result.html).toContain('soporte@prisma.hn');
  });
});
