import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertConfigService } from '../alert-config.service';
import { BrevoNotificationService } from '../brevo-notification.service';
import { AlertTemplateBuilder } from '../alert-template.builder';

@Injectable()
export class OfflineStoresCheckTask {
  private readonly logger = new Logger(OfflineStoresCheckTask.name);
  private readonly lastNotifiedMap = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertConfigService: AlertConfigService,
    private readonly brevoService: BrevoNotificationService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await this.checkOfflineStores();
  }

  async checkOfflineStores() {
    try {
      const config = await this.alertConfigService.getConfig();

      if (!config.alertsEnabled || !config.offlineStoreEnabled) {
        return;
      }

      if (!config.recipientEmails || config.recipientEmails.length === 0) {
        return;
      }

      const thresholdMinutes = config.offlineMinutesThreshold || 15;
      const cooldownMinutes = config.cooldownMinutes || 60;
      const cooldownMs = cooldownMinutes * 60 * 1000;
      const cutoffTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);

      const activeStores = await this.prisma.boStore.findMany({
        where: { isActive: true },
      });

      const now = Date.now();

      for (const store of activeStores) {
        // Estación offline si no tiene lastSeenAt o si su lastSeenAt es anterior al corte
        const isOffline = !store.lastSeenAt || store.lastSeenAt < cutoffTime;

        if (isOffline) {
          const lastNotified = this.lastNotifiedMap.get(store.code);
          if (lastNotified && now - lastNotified < cooldownMs) {
            // En periodo de enfriamiento (cooldown) para no saturar la bandeja
            continue;
          }

          const minutesOffline = store.lastSeenAt
            ? Math.floor((now - store.lastSeenAt.getTime()) / 60000)
            : thresholdMinutes;

          this.logger.warn(
            `Estación ${store.code} (${store.name}) desconectada hace ${minutesOffline} min. Enviando alerta.`,
          );

          const { subject, html } = AlertTemplateBuilder.buildOfflineStoreTemplate({
            storeCode: store.code,
            storeName: store.name,
            minutesOffline,
            lastSeenAt: store.lastSeenAt
              ? store.lastSeenAt.toISOString().replace('T', ' ').substring(0, 19)
              : undefined,
          });

          await this.brevoService.sendEmail({
            to: config.recipientEmails,
            subject,
            htmlContent: html,
          });

          this.lastNotifiedMap.set(store.code, now);
        } else {
          // Si la estación vuelve a estar en línea, limpiamos el cooldown
          if (this.lastNotifiedMap.has(store.code)) {
            this.lastNotifiedMap.delete(store.code);
          }
        }
      }
    } catch (err) {
      this.logger.error(
        `Error verificando estaciones offline: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // Método auxiliar para pruebas unitarias
  clearCooldowns() {
    this.lastNotifiedMap.clear();
  }
}
