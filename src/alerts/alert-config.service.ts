import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AlertConfigDto } from './dto/alert-config.dto';
import { UpdateAlertConfigDto } from './dto/update-alert-config.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AlertConfigService {
  private readonly logger = new Logger(AlertConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Obtiene la configuración activa de alertas desde la BD,
   * con fallback seguro a variables de entorno o valores por defecto.
   */
  async getConfig(): Promise<AlertConfigDto> {
    try {
      const record = await this.prisma.boAlertConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
      });

      if (record) {
        return {
          recipientEmails: this.splitEmails(record.recipientEmails),
          cashVarianceThreshold: Number(record.cashVarianceThreshold),
          alertsEnabled: record.alertsEnabled,
          shiftDiscrepancyEnabled: record.shiftDiscrepancyEnabled,
          fiscalGapEnabled: record.fiscalGapEnabled,
          offlineStoreEnabled: record.offlineStoreEnabled,
          offlineMinutesThreshold: record.offlineMinutesThreshold,
          cooldownMinutes: record.cooldownMinutes,
          updatedAt: record.updatedAt,
        };
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo leer BoAlertConfig de base de datos, usando fallback: ${error instanceof Error ? error.message : error}`,
      );
    }

    return this.getDefaultConfig();
  }

  /**
   * Actualiza o inicializa la configuración de alertas en la base de datos.
   */
  async updateConfig(dto: UpdateAlertConfigDto): Promise<AlertConfigDto> {
    const current = await this.getConfig();

    let normalizedEmails = current.recipientEmails.join(', ');
    if (dto.recipientEmails !== undefined) {
      const validated = this.validateAndNormalizeEmails(dto.recipientEmails);
      normalizedEmails = validated.join(', ');
    }

    const existing = await this.prisma.boAlertConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const dataToSave = {
      recipientEmails: normalizedEmails,
      cashVarianceThreshold:
        dto.cashVarianceThreshold !== undefined
          ? new Prisma.Decimal(dto.cashVarianceThreshold)
          : new Prisma.Decimal(current.cashVarianceThreshold),
      alertsEnabled:
        dto.alertsEnabled !== undefined ? dto.alertsEnabled : current.alertsEnabled,
      shiftDiscrepancyEnabled:
        dto.shiftDiscrepancyEnabled !== undefined
          ? dto.shiftDiscrepancyEnabled
          : current.shiftDiscrepancyEnabled,
      fiscalGapEnabled:
        dto.fiscalGapEnabled !== undefined
          ? dto.fiscalGapEnabled
          : current.fiscalGapEnabled,
      offlineStoreEnabled:
        dto.offlineStoreEnabled !== undefined
          ? dto.offlineStoreEnabled
          : current.offlineStoreEnabled,
      offlineMinutesThreshold:
        dto.offlineMinutesThreshold !== undefined
          ? dto.offlineMinutesThreshold
          : current.offlineMinutesThreshold,
      cooldownMinutes:
        dto.cooldownMinutes !== undefined
          ? dto.cooldownMinutes
          : current.cooldownMinutes,
    };

    let updated;
    if (existing) {
      updated = await this.prisma.boAlertConfig.update({
        where: { id: existing.id },
        data: dataToSave,
      });
    } else {
      updated = await this.prisma.boAlertConfig.create({
        data: dataToSave,
      });
    }

    this.logger.log(`Configuración de alertas actualizada exitosamente (ID: ${updated.id})`);

    return {
      recipientEmails: this.splitEmails(updated.recipientEmails),
      cashVarianceThreshold: Number(updated.cashVarianceThreshold),
      alertsEnabled: updated.alertsEnabled,
      shiftDiscrepancyEnabled: updated.shiftDiscrepancyEnabled,
      fiscalGapEnabled: updated.fiscalGapEnabled,
      offlineStoreEnabled: updated.offlineStoreEnabled,
      offlineMinutesThreshold: updated.offlineMinutesThreshold,
      cooldownMinutes: updated.cooldownMinutes,
      updatedAt: updated.updatedAt,
    };
  }

  private getDefaultConfig(): AlertConfigDto {
    const envEmailsRaw =
      this.configService.get<string>('ALERT_RECIPIENT_EMAILS') ||
      process.env.ALERT_RECIPIENT_EMAILS ||
      '';
    const envThreshold =
      this.configService.get<string>('ALERT_CASH_VARIANCE_THRESHOLD') ||
      process.env.ALERT_CASH_VARIANCE_THRESHOLD;

    const thresholdNumber =
      envThreshold && !isNaN(Number(envThreshold)) ? Number(envThreshold) : 50.0;

    return {
      recipientEmails: this.splitEmails(envEmailsRaw),
      cashVarianceThreshold: thresholdNumber,
      alertsEnabled: true,
      shiftDiscrepancyEnabled: true,
      fiscalGapEnabled: true,
      offlineStoreEnabled: true,
      offlineMinutesThreshold: 15,
      cooldownMinutes: 60,
    };
  }

  private splitEmails(raw: string): string[] {
    if (!raw || typeof raw !== 'string') return [];
    return raw
      .split(/[,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  }

  private validateAndNormalizeEmails(input: string[] | string): string[] {
    const rawList = Array.isArray(input) ? input : this.splitEmails(input);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validated: string[] = [];

    for (const item of rawList) {
      const email = item.trim();
      if (!email) continue;
      if (!emailRegex.test(email)) {
        throw new BadRequestException(`Dirección de correo electrónico inválida: '${email}'`);
      }
      validated.push(email);
    }

    return validated;
  }
}
