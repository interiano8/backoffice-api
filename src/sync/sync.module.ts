import { Module, forwardRef } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [PrismaModule, AlertsModule, forwardRef(() => TelemetryModule)],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
