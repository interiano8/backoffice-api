import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IConnectionFactory } from '../../common/connections/connection-factory.interface';
import type { FusionRepository } from '../domain/ports/fusion-repository.interface';
import { toNum } from '../../common/utils/number-utils';
import {
  GALLON_TO_LITER_FACTOR,
  LITER_TO_GALLON_FACTOR,
} from '../../common/utils/volume-conversion';
@Injectable()
export class FusionProductService {
  private readonly logger = new Logger(FusionProductService.name);

  constructor(
    @Inject('IConnectionFactory')
    private readonly connectionFactory: IConnectionFactory,
    @Inject('FusionRepository') private readonly fusionRepo: FusionRepository,
  ) {}

  async getUnifiedProducts(storeCode: string, fsShiftIds: string) {
    this.logger.log(`getUnifiedProducts store=${storeCode}, ids=${fsShiftIds}`);
    if (!fsShiftIds) return { unified: [], byShift: [] };

    const ids = fsShiftIds
      .split(/[|,]/)
      .map((id) => id.trim())
      .filter((id) => id);
    if (ids.length === 0) return { unified: [], byShift: [] };

    const selectedShifts = await this.fusionRepo.findShiftsByReconcilerIds(
      storeCode,
      ids,
    );
    if (selectedShifts.length === 0) return { unified: [], byShift: [] };

    const uniqueCriteria = this.buildUniqueCriteria(selectedShifts);
    const allSales = await this.fusionRepo.findSalesByCriteria(
      storeCode,
      uniqueCriteria,
    );

    const shiftGroups: Record<string, any> = {};
    const unifiedProducts: Record<string, any> = {};

    allSales.forEach((sale: any) => {
      const groupKey = `${sale.shiftDate ? sale.shiftDate.toISOString().split('T')[0] : 'N/A'}_${sale.shiftNo || 'N/A'}`;
      const prodName = (sale.productName || 'SIN PRODUCTO')
        .toUpperCase()
        .trim();
      const amount = toNum(sale.amount);
      const volume = toNum(sale.volume);
      const unit = (sale.unitOfMeasure || 'GL').toUpperCase();
      const volGL = unit === 'GL' || unit === 'GALON' ? volume : volume * LITER_TO_GALLON_FACTOR;
      const volLT = unit === 'LT' || unit === 'LITRO' ? volume : volume * GALLON_TO_LITER_FACTOR;

      if (!shiftGroups[groupKey])
        shiftGroups[groupKey] = {
          shiftNo: sale.shiftNo || 'N/A',
          shiftDate: sale.shiftDate || new Date(),
          products: {},
        };
      if (!shiftGroups[groupKey].products[prodName])
        shiftGroups[groupKey].products[prodName] = {
          name: prodName,
          amount: 0,
          volume: 0,
          volumeGL: 0,
          volumeLT: 0,
          count: 0,
        };
      shiftGroups[groupKey].products[prodName].amount += amount;
      shiftGroups[groupKey].products[prodName].volume += volume;
      shiftGroups[groupKey].products[prodName].volumeGL += volGL;
      shiftGroups[groupKey].products[prodName].volumeLT += volLT;
      shiftGroups[groupKey].products[prodName].count += 1;

      if (!unifiedProducts[prodName])
        unifiedProducts[prodName] = {
          name: prodName,
          amount: 0,
          volume: 0,
          volumeGL: 0,
          volumeLT: 0,
          count: 0,
        };
      unifiedProducts[prodName].amount += amount;
      unifiedProducts[prodName].volume += volume;
      unifiedProducts[prodName].volumeGL += volGL;
      unifiedProducts[prodName].volumeLT += volLT;
      unifiedProducts[prodName].count += 1;
    });

    return {
      unified: Object.values(unifiedProducts).sort(
        (a: any, b: any) => b.amount - a.amount,
      ),
      byShift: Object.values(shiftGroups)
        .map((group: any) => ({
          shiftNo: group.shiftNo,
          products: Object.values(group.products).sort(
            (a: any, b: any) => b.amount - a.amount,
          ),
        }))
        .sort((a: any, b: any) =>
          a.shiftNo.localeCompare(b.shiftNo, undefined, { numeric: true }),
        ),
    };
  }

  private buildUniqueCriteria(shifts: any[]) {
    return Array.from(
      new Set(
        shifts.map(
          (s: any) => `${s.shiftDate.toISOString().split('T')[0]}|${s.shiftNo}`,
        ),
      ),
    ).map((key) => {
      const [date, no] = key.split('|');
      return { shiftDate: new Date(date), shiftNo: no };
    });
  }
}
