export class AlertConfigDto {
  recipientEmails: string[];
  cashVarianceThreshold: number;
  alertsEnabled: boolean;
  shiftDiscrepancyEnabled: boolean;
  fiscalGapEnabled: boolean;
  offlineStoreEnabled: boolean;
  offlineMinutesThreshold: number;
  cooldownMinutes: number;
  updatedAt?: Date;
}
