import { Injectable, Inject, Logger } from '@nestjs/common';
import { IGetShiftDetailsUseCase } from '../../domain/ports/in/get-shift-details.use-case.port';
import type { ShiftRepository } from '../../domain/ports/shift-repository.interface';
import {
  GALLON_TO_LITER_FACTOR,
  LITER_TO_GALLON_FACTOR,
} from '../../../common/utils/volume-conversion';
import { toNum } from '../../../common/utils/number-utils';
import {
  toUTCMidnight,
  toStartOfDay,
  toEndOfDay,
} from '../../../common/utils/date-utils';

@Injectable()
export class GetShiftDetailsUseCase implements IGetShiftDetailsUseCase {
  private readonly logger = new Logger(GetShiftDetailsUseCase.name);

  constructor(
    @Inject('ShiftRepository')
    private readonly shiftRepo: ShiftRepository,
  ) {}

  async getShiftDetails(
    storeCode: string,
    date: string,
    shiftNo: string,
    attendantName?: string,
  ): Promise<any> {
    const startOfDay = toStartOfDay(date);
    const endOfDay = toEndOfDay(date);

    const sales = await this.shiftRepo.findSales({
      storeCode,
      shiftNo,
      shiftDate: { gte: startOfDay, lte: endOfDay },
      ...(attendantName ? { attendantName } : {}),
    });

    const fuelSales = this.groupFuelSales(sales);
    const productSales = this.groupProductSales(sales);

    const queryShiftDate = toUTCMidnight(date);
    const employeeName = attendantName || '';

    const paymentMethodsFromBo = await this.shiftRepo.findPaymentMethods({
      storeCode,
      shiftDate: queryShiftDate,
      shiftNo,
      employeeName,
      esTicket: false,
    });

    const shiftRecord = await this.shiftRepo.findShiftById(
      storeCode,
      shiftNo,
      queryShiftDate,
      employeeName,
    );

    const counters = {
      InvoiceCashCount: shiftRecord?.invoiceCashCount || 0,
      InvoiceCreditCount: shiftRecord?.invoiceCreditCount || 0,
      CreditNoteCount: shiftRecord?.creditNoteCount || 0,
      OutflowCount: shiftRecord?.outflowCount || 0,
    };

    const saleHeaders = await this.shiftRepo.findSaleHeadersWithLines({
      where: { storeCode, shiftDate: queryShiftDate, shiftNo, employeeName },
    });

    this.normalizeHeaderLines(saleHeaders);

    const documents = {
      invoicesCash: saleHeaders.filter(
        (h) => h.docType === 1 && !this.isCreditPayment(h),
      ),
      invoicesCredit: saleHeaders.filter(
        (h) => h.docType === 2 || (h.docType === 1 && this.isCreditPayment(h)),
      ),
      creditNotes: saleHeaders.filter((h) => h.docType === 3),
      outflows: saleHeaders.filter((h) => h.docType === 7),
    };

    const totalTaxes = saleHeaders
      .filter((h) => h.docType !== 3)
      .reduce((acc, h) => acc + (toNum(h.totalAmount) - toNum(h.subTotal)), 0);

    const tickets = (
      await this.shiftRepo.findPaymentMethods({
        storeCode,
        shiftDate: queryShiftDate,
        shiftNo,
        employeeName,
        esTicket: true,
        NOT: { description: { contains: 'CALIBRACION' } },
      })
    ).filter(
      (t) => !saleHeaders.some((h: any) => h.transactionId === t.transactionId),
    );

    return {
      fuel: Object.values(fuelSales)
        .map((item: any) => ({
          ...item,
          prices: Array.from(item.prices as Set<number>).join(', '),
          fsPrices: Array.from(item.fsPrices as Set<number>).join(', '),
          fsShiftIds: Array.from(item.fsShiftIds as Set<string>).join(', '),
        }))
        .sort(
          (a: any, b: any) =>
            parseInt(a.pumpId || '0', 10) - parseInt(b.pumpId || '0', 10),
        ),
      products: Object.values(productSales).map((item: any) => ({
        ...item,
        prices: Array.from(item.prices as Set<number>).join(', '),
      })),
      paymentMethods: this.aggregatePaymentMethods(paymentMethodsFromBo),
      counters,
      documents: {
        invoicesCash: documents.invoicesCash.map((h) => this.mapHeader(h)),
        invoicesCredit: documents.invoicesCredit.map((h) => this.mapHeader(h)),
        creditNotes: documents.creditNotes.map((h) => this.mapHeader(h)),
        outflows: [
          ...documents.outflows.map((h) => this.mapHeader(h)),
          ...tickets.map((t) => ({
            transactionId: t.transactionId,
            docType: 99,
            docNo: t.transactionId,
            customerNo: '',
            customerName: 'TICKET',
            rtn: '',
            subTotal: Number(t.amount),
            totalAmount: Number(t.amount),
            km: '',
            orden: '',
            placa: '',
            chofer: '',
            lines: [
              {
                lineNo: 1,
                itemNo: t.chargeMethodCode,
                description: t.description,
                quantity: 1,
                unitPrice: Number(t.amount),
                amount: Number(t.amount),
                pump: '',
                hose: '',
              },
            ],
            payments: [
              {
                paymentMethod: t.description,
                amount: Number(t.amount),
                currency: 'HNL',
              },
            ],
          })),
        ],
      },
      totalTaxes,
      tickets: [],
    };
  }

  private isCreditPayment(header: any) {
    const creditValues = ['CREDIT', 'CREDITO', 'CRÉDITO', 'Credito', 'Crédito'];
    return creditValues.includes(
      header.lines?.[0]?.paymentType?.toUpperCase() || '',
    );
  }

  private normalizeHeaderLines(saleHeaders: any[]) {
    saleHeaders.forEach((header) => {
      if (header.lines) {
        header.lines = header.lines.map((line: any) => ({
          ...line,
          amount: toNum(line.amount),
          volume: toNum(line.volume),
          unitPrice: toNum(line.unitPrice),
          discount: toNum(line.discount),
          discountPct: toNum(line.discountPct),
          fsAmount: toNum(line.fsAmount),
          fsPPU: toNum(line.fsPPU),
          fsVolume: toNum(line.fsVolume),
        }));
      }
    });
  }

  private groupFuelSales(sales: any[]) {
    return sales
      .filter((s) => s.pumpId && s.hoseId && s.docType !== 3)
      .reduce(
        (acc, sale) => {
          const isTicket = sale.docType === 7;
          const key = `${sale.pumpId}-${sale.hoseId}-${sale.productName}-${isTicket ? 'TICKET' : 'SALE'}`;
          if (!acc[key]) {
            acc[key] = {
              pumpId: sale.pumpId,
              hoseId: sale.hoseId,
              productName: sale.productName || 'Combustible',
              unitOfMeasure: sale.unitOfMeasure || 'LT',
              volumeGL: 0,
              volumeLT: 0,
              amount: 0,
              discount: 0,
              isTicket,
              prices: new Set<number>(),
              fsAmount: 0,
              fsVolume: 0,
              fsInitialVolume: null as number | null,
              fsFinalVolume: null as number | null,
              fsShiftIds: new Set<string>(),
              fsPrices: new Set<number>(),
            };
          }

          const vol = Number(sale.volume || 0);
          const unit = (sale.unitOfMeasure || 'GL').toUpperCase();

          if (unit === 'GL' || unit === 'GALON') {
            acc[key].volumeGL += vol;
            acc[key].volumeLT += vol * GALLON_TO_LITER_FACTOR;
          } else {
            acc[key].volumeLT += vol;
            acc[key].volumeGL += vol * LITER_TO_GALLON_FACTOR;
          }

          acc[key].amount += Number(sale.amount || 0);
          acc[key].discount += Number(sale.discount || 0);
          if (sale.unitPrice) acc[key].prices.add(Number(sale.unitPrice));
          acc[key].fsAmount += Number(sale.fsAmount || 0);
          acc[key].fsVolume += Number(sale.fsVolume || 0);

          const initVol = Number(sale.fsInitialVolume);
          if (!isNaN(initVol) && sale.fsInitialVolume !== null) {
            if (
              acc[key].fsInitialVolume === null ||
              initVol < acc[key].fsInitialVolume
            ) {
              acc[key].fsInitialVolume = initVol;
            }
          }

          const finalVol = Number(sale.fsFinalVolume);
          if (!isNaN(finalVol) && sale.fsFinalVolume !== null) {
            if (
              acc[key].fsFinalVolume === null ||
              finalVol > acc[key].fsFinalVolume
            ) {
              acc[key].fsFinalVolume = finalVol;
            }
          }

          if (sale.fsShiftId) acc[key].fsShiftIds.add(sale.fsShiftId);
          if (sale.fsPPU) acc[key].fsPrices.add(Number(sale.fsPPU));

          return acc;
        },
        {} as Record<string, any>,
      );
  }

  private groupProductSales(sales: any[]) {
    return sales
      .filter(
        (s) =>
          (!s.pumpId || s.pumpId === '0' || !s.hoseId) &&
          s.docType !== 7 &&
          s.docType !== 3,
      )
      .reduce(
        (acc, sale) => {
          const key = sale.productName || 'Varios';
          if (!acc[key]) {
            acc[key] = {
              productName: key,
              quantity: 0,
              amount: 0,
              discount: 0,
              prices: new Set<number>(),
            };
          }
          acc[key].quantity += Number(sale.volume || 0);
          acc[key].amount += Number(sale.amount || 0);
          acc[key].discount += Number(sale.discount || 0);
          if (sale.unitPrice) acc[key].prices.add(Number(sale.unitPrice));
          return acc;
        },
        {} as Record<string, any>,
      );
  }

  private aggregatePaymentMethods(paymentMethods: any[]) {
    return Object.values(
      paymentMethods.reduce(
        (acc, pm) => {
          const key = pm.description?.trim().toUpperCase() || 'SIN DESCRIPCION';
          if (!acc[key]) {
            acc[key] = {
              code: pm.chargeMethodCode,
              description: pm.description,
              count: 0,
              amount: 0,
              additionalData: pm.additionalData,
            };
          }
          acc[key].count += 1;
          acc[key].amount += Number(pm.amount);
          return acc;
        },
        {} as Record<string, any>,
      ),
    );
  }

  private mapHeader(h: any) {
    return {
      transactionId: h.transactionId,
      docType: h.docType,
      docNo: h.docNo,
      customerNo: h.customerNo,
      customerName: h.customerName,
      rtn: h.rtn,
      subTotal: Number(h.subTotal),
      totalAmount: Number(h.totalAmount),
      km: h.km,
      orden: h.orden,
      placa: h.placa,
      chofer: h.chofer,
      appliedDocNo: h.appliedDocNo,
      movementType: h.payments?.[0]?.description || null,
      date: h.createdAt,
      lines: h.lines.map((l: any) => ({
        lineNo: l.lineNo,
        itemNo: l.externalId,
        description: l.productName,
        quantity: Number(l.volume || 0),
        unit: l.unitOfMeasure || 'UN',
        unitPrice: Number(l.unitPrice),
        amount: Number(l.amount),
        pump: l.pumpId,
        hose: l.hoseId,
        discount: Number(l.discount || 0),
        discountPct: Number(l.discountPct || 0),
        appliedDocNo: l.appliedDocNo,
      })),
      payments:
        h.payments?.map((p: any) => ({
          paymentMethod: p.description,
          amount: Number(p.amount),
          currency: 'HNL',
        })) || [],
    };
  }
}
