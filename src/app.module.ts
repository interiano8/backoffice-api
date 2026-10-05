import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EtlModule } from './etl/etl.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ShiftsModule } from './shifts/shifts.module';
import { StoresModule } from './stores/stores.module';
import { TanksModule } from './tanks/tanks.module';
import { ReportsModule } from './reports/reports.module';
import { CtrlModule } from './ctrl/ctrl.module';
import { DocsModule } from './docs/documents.module';
import { CustomersModule } from './customers/customers.module';
import { ConnectionsModule } from './common/connections/connections.module';
import { UsersModule } from './users/users.module';
import { HosesModule } from './hoses/hoses.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { AuditModule } from './audit/audit.module';
import { SyncModule } from './sync/sync.module';
import { AlertsModule } from './alerts/alerts.module';
import { AccountingModule } from './accounting/accounting.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 60000, // 1 minuto en milisegundos
          limit: 100, // 100 requests por minuto
        },
        {
          name: 'long',
          ttl: 3600000, // 1 hora en milisegundos
          limit: 1000, // 1000 requests por hora
        },
      ],
      errorMessage: 'Demasiadas solicitudes. Por favor espera un momento.',
    }),
    PrismaModule,
    EtlModule,
    AuthModule,
    ShiftsModule,
    StoresModule,
    TanksModule,
    ReportsModule,
    CtrlModule,
    DocsModule,
    CustomersModule,
    ConnectionsModule,
    UsersModule,
    HosesModule,
    ReconciliationModule,
    AuditModule,
    SyncModule,
    AlertsModule,
    AccountingModule,
    PaymentMethodsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
