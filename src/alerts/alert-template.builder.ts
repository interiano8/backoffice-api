export interface ShiftDiscrepancyAlertData {
  storeCode: string;
  shiftDate: string;
  shiftNo: string;
  employeeName: string;
  totalSale: number;
  cashDeclared: number;
  cashVariance: number;
}

export interface FiscalGapAlertData {
  storeCode: string;
  stationName?: string;
  prefix: string;
  missingRanges: string[];
  missingCount: number;
}

export interface OfflineStoreAlertData {
  storeCode: string;
  storeName: string;
  minutesOffline: number;
  lastSeenAt?: string;
}

export interface TestAlertData {
  recipientEmails: string[];
  timestamp: string;
}

export class AlertTemplateBuilder {
  private static baseLayout(title: string, headerColor: string, bodyContent: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background-color: ${headerColor}; padding: 20px 24px; color: #ffffff; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 600; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 24px; }
    .data-table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 20px; font-size: 14px; }
    .data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .data-table th { background-color: #f9fafb; color: #4b5563; font-weight: 600; width: 40%; }
    .badge-danger { background-color: #fee2e2; color: #b91c1c; padding: 4px 8px; border-radius: 4px; font-weight: 700; }
    .badge-warning { background-color: #fef3c7; color: #b45309; padding: 4px 8px; border-radius: 4px; font-weight: 700; }
    .footer { background-color: #f9fafb; padding: 16px 24px; font-size: 12px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${title}</h2>
      <p>Prisma Hub Central &bull; Notificación Automática</p>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Estaciones de Servicio Prisma. Este es un mensaje generado automáticamente por el sistema de auditoría.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  static buildShiftDiscrepancyTemplate(data: ShiftDiscrepancyAlertData): { subject: string; html: string } {
    const subject = `[ALERTA] Descuadre en Turno - Estación ${data.storeCode}`;
    const sign = data.cashVariance > 0 ? '+' : '';
    const formattedVariance = `L. ${sign}${data.cashVariance.toFixed(2)}`;

    const body = `
      <p>Se ha registrado un cierre de turno con un <strong>descuadre superior al umbral configurado</strong>:</p>
      <table class="data-table">
        <tr><th>Estación</th><td><strong>${data.storeCode}</strong></td></tr>
        <tr><th>Fecha de Turno</th><td>${data.shiftDate}</td></tr>
        <tr><th>Número de Turno</th><td>${data.shiftNo}</td></tr>
        <tr><th>Pistero / Operador</th><td>${data.employeeName}</td></tr>
        <tr><th>Total Ventas Teórico</th><td>L. ${data.totalSale.toFixed(2)}</td></tr>
        <tr><th>Efectivo Declarado</th><td>L. ${data.cashDeclared.toFixed(2)}</td></tr>
        <tr><th>Diferencia (Descuadre)</th><td><span class="badge-danger">${formattedVariance}</span></td></tr>
      </table>
      <p>Se recomienda al equipo de auditoría y operaciones revisar el detalle del arqueo en el módulo de <em>Conciliación</em>.</p>
    `;

    return {
      subject,
      html: this.baseLayout('Alerta: Descuadre de Turno', '#dc2626', body),
    };
  }

  static buildFiscalGapTemplate(data: FiscalGapAlertData): { subject: string; html: string } {
    const subject = `[CRÍTICO] Salto de Correlativo Fiscal SAR - Estación ${data.storeCode}`;
    const rangesList = data.missingRanges.map((r) => `<li><code>${r}</code></li>`).join('');

    const body = `
      <p>El motor de auditoría fiscal ha detectado una <strong>omisión de correlatividad en facturación SAR</strong>:</p>
      <table class="data-table">
        <tr><th>Estación</th><td><strong>${data.storeCode}</strong> ${data.stationName ? `(${data.stationName})` : ''}</td></tr>
        <tr><th>Prefijo / Punto Emisión</th><td><code>${data.prefix}</code></td></tr>
        <tr><th>Total Facturas Faltantes</th><td><span class="badge-danger">${data.missingCount} factura(s)</span></td></tr>
      </table>
      <p><strong>Rangos / Folios Omitidos:</strong></p>
      <ul>${rangesList}</ul>
      <p style="color: #b91c1c; font-size: 13px;"><strong>Acción requerida:</strong> Verificar si las facturas fueron anuladas localmente o retenidas por pérdida de conexión para prevenir sanciones tributarias.</p>
    `;

    return {
      subject,
      html: this.baseLayout('Crítico: Salto de Correlativo SAR', '#991b1b', body),
    };
  }

  static buildOfflineStoreTemplate(data: OfflineStoreAlertData): { subject: string; html: string } {
    const subject = `[ADVERTENCIA] Estación Desconectada - ${data.storeName || data.storeCode}`;

    const body = `
      <p>Se ha detectado una <strong>interrupción prolongada de comunicación</strong> con la estación:</p>
      <table class="data-table">
        <tr><th>Código Estación</th><td><strong>${data.storeCode}</strong></td></tr>
        <tr><th>Nombre de Estación</th><td>${data.storeName}</td></tr>
        <tr><th>Tiempo Sin Contacto</th><td><span class="badge-warning">${data.minutesOffline} minutos</span></td></tr>
        <tr><th>Última Comunicación</th><td>${data.lastSeenAt || 'No registrada'}</td></tr>
      </table>
      <p>Por favor verifique la conectividad del enlace a internet o el servicio de agente local en la estación.</p>
    `;

    return {
      subject,
      html: this.baseLayout('Advertencia: Pérdida de Conectividad', '#d97706', body),
    };
  }

  static buildTestTemplate(data: TestAlertData): { subject: string; html: string } {
    const subject = `[DIAGNÓSTICO] Verificación de Alertas - Prisma Hub Central`;
    const recipientsList = data.recipientEmails.map((e) => `<li>${e}</li>`).join('');

    const body = `
      <p>Este correo confirma que el <strong>servicio de alertas automáticas vía Brevo</strong> se encuentra correctamente configurado y operativo en Prisma Hub Central.</p>
      <table class="data-table">
        <tr><th>Hora de Prueba</th><td>${data.timestamp}</td></tr>
        <tr><th>Estado del Servicio</th><td><span style="color: #15803d; font-weight: bold;">OPERATIVO</span></td></tr>
      </table>
      <p><strong>Destinatarios registrados en base de datos:</strong></p>
      <ul>${recipientsList}</ul>
    `;

    return {
      subject,
      html: this.baseLayout('Diagnóstico del Sistema de Alertas', '#2563eb', body),
    };
  }
}
