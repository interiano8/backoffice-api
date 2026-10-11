import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertConfigService } from './alert-config.service';
import { BrevoNotificationService } from './brevo-notification.service';
import { AlertsBroadcastService } from './alerts-broadcast.service';
import { AlertsController } from './alerts.controller';
import { OfflineStoresCheckTask } from './tasks/offline-stores-check.task';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ReconciliationModule)],
  controllers: [AlertsController],
  providers: [
    AlertConfigService,
    BrevoNotificationService,
    AlertsBroadcastService,
    OfflineStoresCheckTask,
  ],
  exports: [AlertConfigService, BrevoNotificationService, AlertsBroadcastService],
})
export class AlertsModule {}
