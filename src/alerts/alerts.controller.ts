import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlertConfigService } from './alert-config.service';
import { BrevoNotificationService } from './brevo-notification.service';
import { AlertTemplateBuilder } from './alert-template.builder';
import { UpdateAlertConfigDto } from './dto/update-alert-config.dto';
import { PrismaService } from '../prisma/prisma.service';
import { FiscalAuditService } from '../reconciliation/application/services/fiscal-audit.service';

export interface OperationalAlertItem {
  id: string;
  type: 'SHIFT_DISCREPANCY' | 'FISCAL_GAP' | 'OFFLINE_STORE';
  severity: 'CRITICAL' | 'WARNING';
  title: string;
  description: string;
  storeCode: string;
  timestamp: string;
  link: string;
  metadata?: Record<string, any>;
}

export interface RecentAlertsResponse {
  total: number;
  criticalCount: number;
  warningCount: number;
  alerts: OperationalAlertItem[];
}

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(
    private readonly alertConfigService: AlertConfigService,
    private readonly brevoService: BrevoNotificationService,
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => FiscalAuditService))
    private readonly fiscalAuditService?: FiscalAuditService,
  ) {}

  @Get('config')
  async getConfig() {
    return this.alertConfigService.getConfig();
  }

  @Put('config')
  async updateConfig(@Body() dto: UpdateAlertConfigDto) {
    return this.alertConfigService.updateConfig(dto);
  }

  @Post('test')
  async sendTestAlert() {
    const config = await this.alertConfigService.getConfig();

    if (!config.recipientEmails || config.recipientEmails.length === 0) {
      throw new BadRequestException(
        'No se puede enviar correo de prueba: no hay correos destinatarios configurados en la base de datos.',
      );
    }

    const { subject, html } = AlertTemplateBuilder.buildTestTemplate({
      recipientEmails: config.recipientEmails,
      timestamp: new Date().toISOString(),
    });

    const result = await this.brevoService.sendEmail({
      to: config.recipientEmails,
      subject,
      htmlContent: html,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      simulated: result.simulated,
      recipients: config.recipientEmails,
      error: result.error,
    };
  }

  @Get('recent')
  async getRecentAlerts(): Promise<RecentAlertsResponse> {
    const config = await this.alertConfigService.getConfig();
    const alerts: OperationalAlertItem[] = [];

    // 1. Turnos con descuadre (DISCREPANCY)
    if (config.alertsEnabled && config.shiftDiscrepancyEnabled) {
      try {
        const shifts = await this.prisma.boShift.findMany({
          where: { auditStatus: 'DISCREPANCY' },
          orderBy: { updatedAt: 'desc' },
          take: 15,
        });

        for (const shift of shifts) {
          const variance = Math.abs(Number(shift.cashVariance || 0));
          const isCritical = variance >= config.cashVarianceThreshold;
          alerts.push({
            id: `shift-${shift.id}`,
            type: 'SHIFT_DISCREPANCY',
            severity: isCritical ? 'CRITICAL' : 'WARNING',
            title: `Descuadre en Turno ${shift.shiftNo} (Tienda ${shift.storeCode})`,
            description: `${shift.employeeName} - Descuadre L. ${Number(shift.cashVariance || 0).toFixed(2)}`,
            storeCode: shift.storeCode,
            timestamp: (shift.endTime || shift.updatedAt).toISOString(),
            link: '/reconciliation',
            metadata: {
              shiftNo: shift.shiftNo,
              employeeName: shift.employeeName,
              cashVariance: Number(shift.cashVariance || 0),
            },
          });
        }
      } catch {
        // Ignorar fallo en consulta para resiliencia
      }
    }

    // 2. Saltos de correlativos fiscales SAR
    if (config.alertsEnabled && config.fiscalGapEnabled && this.fiscalAuditService) {
      try {
        const audit = await this.fiscalAuditService.detectFiscalGaps();
        for (const gap of audit.gaps) {
          alerts.push({
            id: `gap-${gap.storeCode}-${gap.prefix}-${gap.missingFrom}`,
            type: 'FISCAL_GAP',
            severity: 'CRITICAL',
            title: `Salto Fiscal SAR (${gap.prefix}) en Tienda ${gap.storeCode}`,
            description: `${gap.missingCount} factura(s) omitida(s): ${gap.missingFrom} a ${gap.missingTo}`,
            storeCode: gap.storeCode,
            timestamp: new Date().toISOString(),
            link: '/reconciliation',
            metadata: {
              prefix: gap.prefix,
              missingCount: gap.missingCount,
            },
          });
        }
      } catch {
        // Ignorar fallo en auditoría fiscal para resiliencia
      }
    }

    // 3. Estaciones activas desconectadas
    if (config.alertsEnabled && config.offlineStoreEnabled) {
      try {
        const thresholdMinutes = config.offlineMinutesThreshold || 15;
        const cutoffTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);
        const stores = await this.prisma.boStore.findMany({
          where: { isActive: true },
        });

        const now = Date.now();
        for (const store of stores) {
          if (!store.lastSeenAt || store.lastSeenAt < cutoffTime) {
            const minutesOffline = store.lastSeenAt
              ? Math.floor((now - store.lastSeenAt.getTime()) / 60000)
              : thresholdMinutes;

            alerts.push({
              id: `offline-${store.code}`,
              type: 'OFFLINE_STORE',
              severity: 'WARNING',
              title: `Estación Desconectada: ${store.name}`,
              description: `Sin comunicación desde hace ${minutesOffline} minutos`,
              storeCode: store.code,
              timestamp: store.lastSeenAt
                ? store.lastSeenAt.toISOString()
                : store.updatedAt.toISOString(),
              link: '/tiendas',
              metadata: {
                storeName: store.name,
                minutesOffline,
              },
            });
          }
        }
      } catch {
        // Ignorar fallo en tiendas
      }
    }

    // Ordenar de más reciente a más antiguo
    alerts.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return {
      total: alerts.length,
      criticalCount: alerts.filter((a) => a.severity === 'CRITICAL').length,
      warningCount: alerts.filter((a) => a.severity === 'WARNING').length,
      alerts,
    };
  }
}
