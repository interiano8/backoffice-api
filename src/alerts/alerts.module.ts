import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertConfigService } from './alert-config.service';
import { BrevoNotificationService } from './brevo-notification.service';
import { AlertsController } from './alerts.controller';
import { OfflineStoresCheckTask } from './tasks/offline-stores-check.task';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ReconciliationModule)],
  controllers: [AlertsController],
  providers: [
    AlertConfigService,
    BrevoNotificationService,
    OfflineStoresCheckTask,
  ],
  exports: [AlertConfigService, BrevoNotificationService],
})
export class AlertsModule {}
