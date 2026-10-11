import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { OperationalAlertItem } from './alerts.controller';

@Injectable()
export class AlertsBroadcastService {
  private readonly logger = new Logger(AlertsBroadcastService.name);
  private readonly alertSubject = new Subject<OperationalAlertItem>();

  emit(alert: OperationalAlertItem): void {
    this.logger.log(`Broadcasting alert [${alert.severity}]: ${alert.title}`);
    this.alertSubject.next(alert);
  }

  getAlerts$(): Observable<OperationalAlertItem> {
    return this.alertSubject.asObservable();
  }
}
