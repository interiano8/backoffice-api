import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ShiftEntity } from '../domain/shift.entity';
import type {
  PresentationRepository,
  PresentationResult,
} from '../domain/ports/presentation-repository.interface';

@Injectable()
export class PrismaPresentationRepository implements PresentationRepository {
  private readonly logger = new Logger(PrismaPresentationRepository.name);

  constructor(private prisma: PrismaService) {}

  async getExpectedShiftPresentation(
    storeCode: string,
    shiftDate: string,
    shiftNo: string,
    employeeName: string,
  ): Promise<PresentationResult> {
    const queryShiftDate = this.toUTCMidnight(shiftDate);

    const paymentMethods = await this.prisma.boPaymentMethod.findMany({
      where: {
        storeCode,
        shiftNo,
        employeeName,
        shiftDate: queryShiftDate,
        esTicket: false,
      },
    });

    const groupedMethods: Record<
      string,
      { expected: number; type: 'cash' | 'card' | 'other' }
    > = {};

    paymentMethods.forEach((pm) => {
      const amount = Number(pm.amount || 0);
      const methodCode = pm.chargeMethodCode?.toLowerCase() || '';
      const desc = pm.description?.trim() || 'Desconocido';
      const descLower = desc.toLowerCase();

      let type: 'cash' | 'card' | 'other' = 'other';
      if (descLower.includes('efecti') || methodCode === '01') type = 'cash';
      else if (
        descLower.includes('tarjet') ||
        descLower.includes('visa') ||
        descLower.includes('master') ||
        descLower.includes('pos')
      )
        type = 'card';

      if (!groupedMethods[desc]) groupedMethods[desc] = { expected: 0, type };
      groupedMethods[desc].expected += amount;
    });

    const expectedList = Object.entries(groupedMethods).map(([name, data]) => ({
      name,
      expected: data.expected,
      type: data.type,
      declared: 0,
      difference: 0,
      raw: null,
    }));

    let systemCash = 0,
      systemCard = 0,
      systemOther = 0;
    expectedList.forEach((item) => {
      if (item.type === 'cash') systemCash += item.expected;
      else if (item.type === 'card') systemCard += item.expected;
      else systemOther += item.expected;
    });

    return {
      success: true,
      expected: {
        list: expectedList,
        totals: {
          cash: systemCash,
          card: systemCard,
          other: systemOther,
          total: systemCash + systemCard + systemOther,
        },
      },
    };
  }

  async saveShiftPresentation(
    storeCode: string,
    data: any,
  ): Promise<PresentationResult> {
    const { shiftDate, shiftNo, employeeName, details } = data;
    const queryShiftDate = this.toUTCMidnight(shiftDate);

    const shiftRecord = await this.prisma.boShift.findUnique({
      where: {
        source_storeCode_shiftDate_shiftNo_employeeName: {
          source: 'TPV',
          storeCode,
          shiftDate: queryShiftDate,
          shiftNo,
          employeeName,
        },
      },
    });

    if (!shiftRecord) {
      throw new Error(
        `Shift not found for Date: ${queryShiftDate}, No: ${shiftNo}, Emp: ${employeeName}`,
      );
    }

    if (shiftRecord.isPresented && shiftRecord.presentationDate) {
      const store = await this.prisma.boStore.findUnique({
        where: { code: storeCode },
        select: { PresentationMinutes: true },
      });
      const lockMinutes = store?.PresentationMinutes ?? 30;
      const elapsedMs = Date.now() - new Date(shiftRecord.presentationDate).getTime();
      const elapsedMinutes = elapsedMs / 60000;

      if (lockMinutes > 0 && elapsedMinutes >= lockMinutes) {
        return {
          success: false,
          error: `La presentación ya no se puede editar. Han transcurrido ${Math.floor(elapsedMinutes)} minutos (límite: ${lockMinutes}).`,
        };
      }
    }

    let systemCash = 0,
      systemCard = 0,
      systemOther = 0;
    let declaredCash = 0,
      declaredCard = 0,
      declaredOther = 0;

    const presentationDetails = (details || []).map((d: any) => {
      const expect = Number(d.expected || 0);
      const decl = Number(String(d.declared || 0).replace(/,/g, ''));
      const type = d.type || 'other';

      if (type === 'cash') {
        systemCash += expect;
        declaredCash += decl;
      } else if (type === 'card') {
        systemCard += expect;
        declaredCard += decl;
      } else {
        systemOther += expect;
        declaredOther += decl;
      }

      return {
        name: d.name,
        expected: expect,
        declared: decl,
        difference: Number((decl - expect).toFixed(2)),
        type,
        raw: d.raw || null,
      };
    });

    const totalDiff = Number(
      (
        declaredCash -
        systemCash +
        (declaredCard - systemCard) +
        (declaredOther - systemOther)
      ).toFixed(2),
    );
    const isBalanced = Math.abs(totalDiff) <= 0.05;

    const updatedShift = await this.prisma.boShift.update({
      where: { id: shiftRecord.id },
      data: {
        isPresented: true,
        cashDeclared: declaredCash,
        cardDeclared: declaredCard,
        otherDeclared: declaredOther,
        isBalanced,
        presentationDate: new Date(),
        presentationDetails: JSON.stringify(presentationDetails),
        presentationComment: data.comment || null,
      },
    });

    return {
      success: true,
      isBalanced,
      differences: {
        cash: declaredCash - systemCash,
        card: declaredCard - systemCard,
        other: declaredOther - systemOther,
        total: totalDiff,
      },
      systemTotals: { cash: systemCash, card: systemCard, other: systemOther },
      declared: {
        cash: declaredCash,
        card: declaredCard,
        other: declaredOther,
      },
      details: presentationDetails,
      shift: updatedShift as unknown as ShiftEntity,
    };
  }

  async printShiftReport(
    storeCode: string,
    shiftDate: string,
    shiftNo: string,
    employeeName: string,
    printedBy: string,
    details: any,
  ): Promise<PresentationResult> {
    const count = await this.prisma.boPrintedReport.count({
      where: {
        storeCode,
        shiftDate: new Date(shiftDate),
        shiftNo,
        employeeName,
      },
    });

    const report = await this.prisma.boPrintedReport.create({
      data: {
        storeCode,
        shiftDate: new Date(shiftDate),
        shiftNo,
        employeeName,
        printedBy,
        stationName: details.stationName || 'Unknown Station',
        version: count + 1,
        dataSnapshot: JSON.stringify(details),
        printedAt: new Date(),
      },
    });

    return {
      success: true,
      version: report.version,
      printedBy: report.printedBy,
      printedAt: report.printedAt,
      stationName: report.stationName,
    };
  }

  private toUTCMidnight(shiftDate: string): Date {
    if (shiftDate.includes('T'))
      return new Date(shiftDate.split('T')[0] + 'T00:00:00Z');
    return new Date(shiftDate + 'T00:00:00Z');
  }
}
