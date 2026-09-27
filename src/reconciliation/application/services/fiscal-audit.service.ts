import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AlertConfigService } from '../../../alerts/alert-config.service';
import { BrevoNotificationService } from '../../../alerts/brevo-notification.service';
import { AlertTemplateBuilder } from '../../../alerts/alert-template.builder';

export interface FiscalGap {
  storeCode: string;
  prefix: string;
  missingFrom: string;
  missingTo: string;
  missingCount: number;
  missingDocNos: string[];
}

export interface FiscalAuditReport {
  storeCode?: string;
  totalInvoicesScanned: number;
  totalGapsDetected: number;
  totalMissingInvoices: number;
  hasGaps: boolean;
  gaps: FiscalGap[];
  checkedAt: string;
}

@Injectable()
export class FiscalAuditService {
  private readonly logger = new Logger(FiscalAuditService.name);
  private readonly SAR_REGEX = /^(\d{3}-\d{3}-\d{2}-)(\d{8})$/;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly alertConfigService?: AlertConfigService,
    @Optional() private readonly brevoService?: BrevoNotificationService,
  ) {}

  async detectFiscalGaps(storeCode?: string): Promise<FiscalAuditReport> {
    const where: any = {};
    if (storeCode && storeCode.trim() !== '') {
      where.storeCode = storeCode.trim();
    }

    const sales = await this.prisma.boSaleHeader.findMany({
      where,
      select: {
        storeCode: true,
        docNo: true,
      },
      orderBy: {
        docNo: 'asc',
      },
    });

    const report = this.analyzeSequences(sales, storeCode);
    if (report.hasGaps) {
      await this.checkAndDispatchFiscalGapAlert(report);
    }
    return report;
  }

  private async checkAndDispatchFiscalGapAlert(report: FiscalAuditReport) {
    if (!this.alertConfigService || !this.brevoService) {
      return;
    }

    try {
      const config = await this.alertConfigService.getConfig();

      if (!config.alertsEnabled || !config.fiscalGapEnabled) {
        return;
      }

      if (!config.recipientEmails || config.recipientEmails.length === 0) {
        return;
      }

      for (const gap of report.gaps) {
        const { subject, html } = AlertTemplateBuilder.buildFiscalGapTemplate({
          storeCode: gap.storeCode,
          prefix: gap.prefix,
          missingRanges: [`${gap.missingFrom} - ${gap.missingTo}`],
          missingCount: gap.missingCount,
        });

        void this.brevoService
          .sendEmail({
            to: config.recipientEmails,
            subject,
            htmlContent: html,
          })
          .catch((err) => {
            this.logger.error(`Error enviando alerta de salto fiscal: ${err.message}`);
          });
      }
    } catch (err: any) {
      this.logger.debug(`Error evaluando alerta de salto fiscal: ${err.message}`);
    }
  }

  analyzeSequences(
    records: Array<{ storeCode: string; docNo: string }>,
    storeCodeFilter?: string,
  ): FiscalAuditReport {
    const groups = new Map<
      string,
      { storeCode: string; prefix: string; numbers: number[] }
    >();

    let totalInvoicesScanned = 0;

    for (const rec of records) {
      if (!rec.docNo) continue;
      const match = this.SAR_REGEX.exec(rec.docNo.trim());
      if (!match) continue;

      totalInvoicesScanned++;
      const prefix = match[1];
      const seqNumber = parseInt(match[2], 10);
      const groupKey = `${rec.storeCode}::${prefix}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          storeCode: rec.storeCode,
          prefix,
          numbers: [],
        });
      }

      groups.get(groupKey)!.numbers.push(seqNumber);
    }

    const gaps: FiscalGap[] = [];
    let totalMissingInvoices = 0;

    for (const group of groups.values()) {
      const uniqueSorted = Array.from(new Set(group.numbers)).sort(
        (a, b) => a - b,
      );

      for (let i = 0; i < uniqueSorted.length - 1; i++) {
        const current = uniqueSorted[i];
        const next = uniqueSorted[i + 1];

        if (next > current + 1) {
          const missingStart = current + 1;
          const missingEnd = next - 1;
          const count = missingEnd - missingStart + 1;
          totalMissingInvoices += count;

          const missingDocNos: string[] = [];
          for (
            let m = missingStart;
            m <= Math.min(missingEnd, missingStart + 19);
            m++
          ) {
            missingDocNos.push(`${group.prefix}${m.toString().padStart(8, '0')}`);
          }
          if (count > 20) {
            missingDocNos.push(`... y ${count - 20} más`);
          }

          gaps.push({
            storeCode: group.storeCode,
            prefix: group.prefix,
            missingFrom: `${group.prefix}${missingStart.toString().padStart(8, '0')}`,
            missingTo: `${group.prefix}${missingEnd.toString().padStart(8, '0')}`,
            missingCount: count,
            missingDocNos,
          });
        }
      }
    }

    return {
      storeCode: storeCodeFilter,
      totalInvoicesScanned,
      totalGapsDetected: gaps.length,
      totalMissingInvoices,
      hasGaps: gaps.length > 0,
      gaps,
      checkedAt: new Date().toISOString(),
    };
  }
}
