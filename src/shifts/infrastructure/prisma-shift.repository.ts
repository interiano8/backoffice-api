import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ShiftRepository,
  SaleHeaderWithLinesResult,
} from '../domain/ports/shift-repository.interface';
import type {
  ShiftEntity,
  SaleEntity,
  SaleHeaderEntity,
  PaymentMethodEntity,
} from '../domain/shift.entity';

@Injectable()
export class PrismaShiftRepository implements ShiftRepository {
  constructor(private prisma: PrismaService) {}

  async findShifts(
    storeCode: string,
    date?: string,
    status?: string,
  ): Promise<any[]> {
    const where: any = { storeCode };
    if (date) {
      const queryDate = new Date(date);
      const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));
      where.shiftDate = { gte: startOfDay, lte: endOfDay };
    }
    if (status) where.status = status;
    return this.prisma.boShift.findMany({
      where,
      orderBy: [{ shiftDate: 'desc' }, { shiftNo: 'desc' }],
      take: 2000,
    }) as unknown as ShiftEntity[];
  }

  async findShiftById(
    storeCode: string,
    shiftNo: string,
    shiftDate: Date,
    employeeName: string,
  ): Promise<any | null> {
    return this.prisma.boShift.findUnique({
      where: {
        source_storeCode_shiftDate_shiftNo_employeeName: {
          source: 'TPV',
          storeCode,
          shiftDate,
          shiftNo,
          employeeName,
        },
      },
    }) as unknown as ShiftEntity | null;
  }

  async findSales(where: any): Promise<any[]> {
    const options = where && typeof where === 'object' && ('where' in where || 'select' in where || 'orderBy' in where)
      ? where
      : { where };
    return this.prisma.boSale.findMany(options) as unknown as SaleEntity[];
  }

  async findSaleHeadersWithLines(where: any): Promise<any[]> {
    const options = where && typeof where === 'object' && 'where' in where ? where : { where };
    return this.prisma.boSaleHeader.findMany({
      ...options,
      include: {
        lines: {
          select: {
            id: true,
            amount: true,
            volume: true,
            unitPrice: true,
            productName: true,
            unitOfMeasure: true,
            pumpId: true,
            hoseId: true,
            tankId: true,
            saleIdFusion: true,
            discount: true,
            discountPct: true,
            docType: true,
            paymentType: true,
          },
        },
        payments: true,
      },
      orderBy: { docNo: 'asc' },
    }) as unknown as SaleHeaderWithLinesResult[];
  }

  async findSaleHeaders(where: any): Promise<any[]> {
    const options = where && typeof where === 'object' && ('where' in where || 'select' in where || 'orderBy' in where)
      ? where
      : { where };
    return this.prisma.boSaleHeader.findMany(
      options,
    ) as unknown as SaleHeaderEntity[];
  }

  async countSaleHeaders(where: any): Promise<number> {
    const options = where && typeof where === 'object' && ('where' in where || 'select' in where)
      ? where
      : { where };
    return this.prisma.boSaleHeader.count(options);
  }

  async findPaymentMethods(where: any): Promise<any[]> {
    const options = where && typeof where === 'object' && ('where' in where || 'select' in where || 'orderBy' in where)
      ? where
      : { where };
    return this.prisma.boPaymentMethod.findMany(
      options,
    ) as unknown as PaymentMethodEntity[];
  }

  async getShiftCounters(storeCode: string, shiftDate: Date, shiftNo: string) {
    const shift = await this.prisma.boShift.findFirst({
      where: { storeCode, shiftDate, shiftNo },
      select: {
        invoiceCashCount: true,
        invoiceCreditCount: true,
        creditNoteCount: true,
        outflowCount: true,
      },
    });
    return {
      invoiceCashCount: shift?.invoiceCashCount || 0,
      invoiceCreditCount: shift?.invoiceCreditCount || 0,
      creditNoteCount: shift?.creditNoteCount || 0,
      outflowCount: shift?.outflowCount || 0,
    };
  }

  async getUniqueDates(storeCode: string): Promise<Date[]> {
    const result = await this.prisma.boShift.findMany({
      where: { storeCode },
      select: { shiftDate: true },
      distinct: ['shiftDate'],
      orderBy: { shiftDate: 'desc' },
    });
    return result.map((r) => r.shiftDate);
  }

  async queryRawUnsafe(query: string, params?: any[]): Promise<any[]> {
    return this.prisma.$queryRawUnsafe(
      query,
      ...(params || []),
    ) as unknown as unknown[];
  }
}
