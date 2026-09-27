import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DashboardRepository,
  DashboardStatsResult,
  GlobalDashboardResult,
  MonthlyAnalysisResult,
} from '../domain/ports/dashboard-repository.interface';

const GALLON_TO_LITER_FACTOR = 3.78541;

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  private readonly logger = new Logger(PrismaDashboardRepository.name);

  constructor(private prisma: PrismaService) {}

  async getDashboardStats(
    storeCode: string,
    days: number = 15,
    date?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<DashboardStatsResult> {
    if (storeCode === 'GLOBAL' || !storeCode) {
      return (await this.getGlobalDashboardStats(days, date, startDate, endDate)) as any;
    }

    const actualStartDate =
      startDate ||
      date ||
      new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    const actualEndDate =
      endDate || date || new Date().toISOString().split('T')[0];

    const start = new Date(actualStartDate + 'T00:00:00.000Z');
    const end = new Date(actualEndDate + 'T23:59:59.999Z');

    const boSales = await this.prisma.boSale.findMany({
      where: {
        storeCode,
        shiftDate: { gte: start, lte: end },
      },
    });

    if (boSales.length > 0) {
      return this.aggregateBoSales(boSales, storeCode, start, end);
    }

    return this.getTpvDashboardStats(storeCode, actualStartDate, actualEndDate);
  }

  async getGlobalDashboardStats(
    days: number = 15,
    date?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalDashboardResult> {
    const actualStartDate =
      startDate ||
      date ||
      new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    const actualEndDate =
      endDate || date || new Date().toISOString().split('T')[0];

    const start = new Date(actualStartDate + 'T00:00:00.000Z');
    const end = new Date(actualEndDate + 'T23:59:59.999Z');

    const stores = await this.prisma.boStore.findMany({
      where: { isActive: true },
      select: { code: true, name: true, titulo: true },
    });
    const storeMap = new Map(stores.map((s) => [s.code, s.name]));

    const [sales, headers, payments] = await Promise.all([
      this.prisma.boSale.findMany({
        where: {
          shiftDate: { gte: start, lte: end },
        },
      }),
      this.prisma.boSaleHeader.findMany({
        where: {
          shiftDate: { gte: start, lte: end },
        },
      }),
      this.prisma.boPaymentMethod.findMany({
        where: {
          shiftDate: { gte: start, lte: end },
        },
      }),
    ]);

    let totalAmount = 0;
    let totalVolume = 0;

    const storeRankingMap = new Map<string, { storeCode: string; storeName: string; totalAmount: number; totalVolumeGL: number; transactionCount: number }>();
    stores.forEach((st) => {
      storeRankingMap.set(st.code, {
        storeCode: st.code,
        storeName: st.name,
        totalAmount: 0,
        totalVolumeGL: 0,
        transactionCount: 0,
      });
    });

    const productMap = new Map<string, { name: string; productName: string; totalAmount: number; totalVolumeGL: number; count: number }>();
    const dailyMap = new Map<string, { date: string; totalAmount: number; totalVolumeGL: number }>();
    const hourlyMap = new Map<string, { hour: string; amount: number; volume: number; TOTAL: number }>();

    for (let i = 0; i < 24; i++) {
      const h = `${i.toString().padStart(2, '0')}:00`;
      hourlyMap.set(h, { hour: h, amount: 0, volume: 0, TOTAL: 0 });
    }

    sales.forEach((s) => {
      const amt = Number(s.amount || 0);
      const vol = Number(s.volume || 0);
      const volGL = vol / GALLON_TO_LITER_FACTOR;
      const prod = s.productName?.trim().toUpperCase() || 'OTROS';
      const sc = s.storeCode;

      totalAmount += amt;
      totalVolume += vol;

      // Ranking por Tienda
      if (!storeRankingMap.has(sc)) {
        storeRankingMap.set(sc, {
          storeCode: sc,
          storeName: storeMap.get(sc) || `Tienda ${sc}`,
          totalAmount: 0,
          totalVolumeGL: 0,
          transactionCount: 0,
        });
      }
      const stData = storeRankingMap.get(sc)!;
      stData.totalAmount += amt;
      stData.totalVolumeGL += volGL;

      // Productos
      if (!productMap.has(prod)) {
        productMap.set(prod, {
          name: prod,
          productName: prod,
          totalAmount: 0,
          totalVolumeGL: 0,
          count: 0,
        });
      }
      const prodData = productMap.get(prod)!;
      prodData.totalAmount += amt;
      prodData.totalVolumeGL += volGL;
      prodData.count += 1;

      // Diario
      const dStr = s.shiftDate ? new Date(s.shiftDate).toISOString().split('T')[0] : 'Sin Fecha';
      if (!dailyMap.has(dStr)) {
        dailyMap.set(dStr, { date: dStr, totalAmount: 0, totalVolumeGL: 0 });
      }
      const dData = dailyMap.get(dStr)!;
      dData.totalAmount += amt;
      dData.totalVolumeGL += volGL;

      // Horario
      if (s.timestamp) {
        const hour = `${new Date(s.timestamp).getHours().toString().padStart(2, '0')}:00`;
        const hData = hourlyMap.get(hour);
        if (hData) {
          hData.amount += amt;
          hData.volume += volGL;
        }
      }
    });

    // Transacciones
    headers.forEach((h) => {
      const sc = h.storeCode;
      if (storeRankingMap.has(sc)) {
        storeRankingMap.get(sc)!.transactionCount += 1;
      }
    });

    // Métodos de Pago
    const paymentMap = new Map<string, { name: string; amount: number; count: number }>();
    payments.forEach((p) => {
      const desc = p.description?.trim().toUpperCase() || 'OTRO';
      if (!paymentMap.has(desc)) {
        paymentMap.set(desc, { name: desc, amount: 0, count: 0 });
      }
      const pData = paymentMap.get(desc)!;
      pData.amount += Number(p.amount || 0);
      pData.count += 1;
    });

    const storeRanking = Array.from(storeRankingMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const products = Array.from(productMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const paymentMethods = Array.from(paymentMap.values()).sort((a, b) => b.amount - a.amount);
    const dailySales = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const hourlyTraffic = Array.from(hourlyMap.values());

    return {
      totalAmount,
      totalVolumeGL: totalVolume / GALLON_TO_LITER_FACTOR,
      totalTransactions: headers.length,
      activeStoresCount: stores.length,
      storeRanking,
      products,
      paymentMethods,
      dailySales,
      hourlyTraffic,
    };
  }

  private async aggregateBoSales(
    sales: any[],
    storeCode: string,
    start: Date,
    end: Date,
  ): Promise<DashboardStatsResult> {
    let totalVolume = 0;
    let totalAmount = 0;

    const productMap: Record<string, any> = {};
    const dailyMap: Record<string, any> = {};
    const attendantMap: Record<string, any> = {};
    const pumpMap: Record<string, any> = {};
    const hourlyMap: Record<string, any> = {};

    for (let i = 0; i < 24; i++) {
      const hourStr = `${i.toString().padStart(2, '0')}:00`;
      hourlyMap[hourStr] = { hour: hourStr, volume: 0, amount: 0, TOTAL: 0 };
    }

    sales.forEach((s) => {
      const vol = Number(s.volume || 0);
      const amt = Number(s.amount || 0);
      const prodName = s.productName || 'Varios';
      const attName = s.attendantName || 'Desconocido';
      const pumpId = s.pumpId || '0';

      totalVolume += vol;
      totalAmount += amt;

      if (!productMap[prodName]) {
        productMap[prodName] = {
          name: prodName,
          productName: prodName,
          totalVolume: 0,
          volumeLT: 0,
          volumeGL: 0,
          totalAmount: 0,
          amount: 0,
          count: 0,
        };
      }
      productMap[prodName].totalVolume += vol;
      productMap[prodName].volumeLT += vol;
      productMap[prodName].volumeGL += vol / GALLON_TO_LITER_FACTOR;
      productMap[prodName].totalAmount += amt;
      productMap[prodName].amount += amt;
      productMap[prodName].count += 1;

      const dateStr = s.shiftDate
        ? new Date(s.shiftDate).toISOString().split('T')[0]
        : 'Sin Fecha';
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = {
          date: dateStr,
          totalVolume: 0,
          totalAmount: 0,
          volume: 0,
          amount: 0,
        };
      }
      dailyMap[dateStr].totalVolume += vol;
      dailyMap[dateStr].volume += vol;
      dailyMap[dateStr].totalAmount += amt;
      dailyMap[dateStr].amount += amt;
      dailyMap[dateStr][prodName] = (dailyMap[dateStr][prodName] || 0) + vol;

      if (!attendantMap[attName]) {
        attendantMap[attName] = {
          employeeName: attName,
          employee: attName,
          fullName: attName,
          totalVolume: 0,
          volumeLT: 0,
          volumeGL: 0,
          totalAmount: 0,
          amount: 0,
          transactionCount: 0,
          count: 0,
        };
      }
      attendantMap[attName].totalVolume += vol;
      attendantMap[attName].volumeLT += vol;
      attendantMap[attName].volumeGL += vol / GALLON_TO_LITER_FACTOR;
      attendantMap[attName].totalAmount += amt;
      attendantMap[attName].amount += amt;
      attendantMap[attName].transactionCount += 1;
      attendantMap[attName].count += 1;

      if (pumpId && pumpId !== '0') {
        if (!pumpMap[pumpId]) {
          pumpMap[pumpId] = {
            pumpId,
            totalVolume: 0,
            totalAmount: 0,
          };
        }
        pumpMap[pumpId].totalVolume += vol;
        pumpMap[pumpId].totalAmount += amt;
      }

      if (s.timestamp) {
        const hourIndex = new Date(s.timestamp).getHours();
        const hourStr = `${hourIndex.toString().padStart(2, '0')}:00`;
        if (hourlyMap[hourStr]) {
          hourlyMap[hourStr].volume += vol;
          hourlyMap[hourStr].amount += amt;
          hourlyMap[hourStr].TOTAL = (hourlyMap[hourStr].TOTAL || 0) + 1;
          hourlyMap[hourStr][prodName] = (hourlyMap[hourStr][prodName] || 0) + vol;
        }
      }
    });

    const paymentRecords = await this.prisma.boPaymentMethod.findMany({
      where: {
        storeCode,
        shiftDate: { gte: start, lte: end },
      },
    });

    const paymentMap: Record<string, any> = {};
    paymentRecords.forEach((pm) => {
      const desc = pm.description?.trim().toUpperCase() || 'OTRO';
      if (!paymentMap[desc]) {
        paymentMap[desc] = {
          name: desc,
          description: desc,
          amount: 0,
          count: 0,
        };
      }
      paymentMap[desc].amount += Number(pm.amount || 0);
      paymentMap[desc].count += 1;
    });

    const products = Object.values(productMap).sort(
      (a: any, b: any) => b.totalAmount - a.totalAmount,
    );
    const dailyVolume = Object.values(dailyMap).sort(
      (a: any, b: any) => a.date.localeCompare(b.date),
    );
    const attendants = Object.values(attendantMap).sort(
      (a: any, b: any) => b.totalAmount - a.totalAmount,
    );
    const pumps = Object.values(pumpMap).sort(
      (a: any, b: any) => parseInt(a.pumpId, 10) - parseInt(b.pumpId, 10),
    );
    const paymentMethods = Object.values(paymentMap).sort(
      (a: any, b: any) => b.amount - a.amount,
    );
    const hourly = Object.values(hourlyMap);

    return {
      products,
      dailyVolume,
      dailyAmount: dailyVolume,
      attendants,
      pumps,
      paymentMethods,
      hourly,
      topCustomers: [],
      totalVolume,
      totalVolumeLT: totalVolume,
      totalVolumeGL: totalVolume / GALLON_TO_LITER_FACTOR,
      totalAmount,
    };
  }

  private async getTpvDashboardStats(
    storeCode: string,
    startDate: string,
    endDate: string,
  ): Promise<DashboardStatsResult> {
    return {
      products: [],
      dailyVolume: [],
      attendants: [],
      pumps: [],
      paymentMethods: [],
      hourly: [],
      topCustomers: [],
      totalVolume: 0,
      totalVolumeLT: 0,
      totalVolumeGL: 0,
      totalAmount: 0,
    };
  }

  async getMonthlyAnalysis(
    storeCode: string,
    startDate1: string,
    endDate1: string,
    startDate2: string,
    endDate2: string,
  ): Promise<MonthlyAnalysisResult> {
    return {
      period1: { label: `${startDate1} al ${endDate1}`, contado: 0, credito: 0, dailyData: [] },
      period2: { label: `${startDate2} al ${endDate2}`, contado: 0, credito: 0, dailyData: [] },
      discountComparison: { current: 0, previous: 0, difference: 0, percentChange: 0 },
      fuelGrowth: [],
    };
  }
}
