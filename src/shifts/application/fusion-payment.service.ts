import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IConnectionFactory } from '../../common/connections/connection-factory.interface';
import type { FusionRepository } from '../domain/ports/fusion-repository.interface';
import { toNum } from '../../common/utils/number-utils';

@Injectable()
export class FusionPaymentService {
  private readonly logger = new Logger(FusionPaymentService.name);

  constructor(
    @Inject('IConnectionFactory')
    private readonly connectionFactory: IConnectionFactory,
    @Inject('FusionRepository') private readonly fusionRepo: FusionRepository,
  ) {}

  async getUnifiedPayments(storeCode: string, fsShiftIds: string) {
    this.logger.log(`getUnifiedPayments store=${storeCode}, ids=${fsShiftIds}`);
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
    const [allPayments, shifts] = await Promise.all([
      this.fusionRepo.findPaymentMethodsByCriteria(storeCode, uniqueCriteria),
      this.fusionRepo.findShiftsByCriteria(storeCode, uniqueCriteria),
    ]);

    const shiftGroups = this.groupShifts(shifts);
    const byShift = this.computeByShiftPayments(
      Object.values(shiftGroups),
      allPayments,
      shifts,
    );

    const unifiedMethodsMap: Record<string, any> = {};
    allPayments.forEach((p: any) => {
      const key = (p.description || 'OTROS').toUpperCase().trim();
      if (!unifiedMethodsMap[key])
        unifiedMethodsMap[key] = {
          amount: 0,
          count: 0,
          code: p.chargeMethodCode,
          description: p.description,
        };
      unifiedMethodsMap[key].amount += toNum(p.amount);
      unifiedMethodsMap[key].count += 1;
    });

    const unifiedDeclared = this.computeDeclaredMap(shifts);
    const unified = this.mergePaymentsAndDeclared(
      unifiedMethodsMap,
      unifiedDeclared,
    );

    return { unified, byShift };
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

  private groupShifts(shifts: any[]) {
    const groups: Record<string, any> = {};
    shifts.forEach((s: any) => {
      const key = `${s.shiftDate.toISOString().split('T')[0]}_${s.shiftNo}`;
      if (!groups[key]) {
        groups[key] = {
          shiftNo: s.shiftNo,
          shiftDate: s.shiftDate,
          reconcilerShiftIds: [],
          employeeNames: [],
          presentationStatus: {},
        };
      }
      if (s.reconcilerShiftId) {
        groups[key].reconcilerShiftIds.push(s.reconcilerShiftId);
        groups[key].presentationStatus[s.reconcilerShiftId] = {
          employeeName: s.employeeName,
          isPresented: s.isPresented,
        };
      }
      if (
        s.employeeName &&
        !groups[key].employeeNames.includes(s.employeeName)
      ) {
        groups[key].employeeNames.push(s.employeeName);
      }
    });
    return groups;
  }

  private computeByShiftPayments(
    groups: any[],
    allPayments: any[],
    shifts: any[],
  ) {
    return groups
      .map((group: any) => {
        const shiftPayments = allPayments.filter(
          (p: any) =>
            p.shiftNo === group.shiftNo &&
            p.shiftDate.toISOString().split('T')[0] ===
              group.shiftDate.toISOString().split('T')[0],
        );

        const methodsMap: Record<string, any> = {};
        shiftPayments.forEach((p: any) => {
          const key = (p.description || 'OTROS').toUpperCase().trim();
          if (!methodsMap[key])
            methodsMap[key] = {
              amount: 0,
              count: 0,
              code: p.chargeMethodCode,
              description: p.description,
            };
          methodsMap[key].amount += toNum(p.amount);
          methodsMap[key].count += 1;
        });

        const shiftDeclared: Record<string, any> = {};
        shifts
          .filter((s: any) => s.shiftNo === group.shiftNo)
          .forEach((s: any) => {
            if (s.isPresented && s.presentationDetails) {
              try {
                const details =
                  typeof s.presentationDetails === 'string'
                    ? JSON.parse(s.presentationDetails)
                    : s.presentationDetails;
                if (Array.isArray(details))
                  details.forEach((d: any) => {
                    const name = (d.name || 'Desconocido').toUpperCase().trim();
                    if (!shiftDeclared[name])
                      shiftDeclared[name] = {
                        declared: 0,
                        description: d.name,
                      };
                    shiftDeclared[name].declared += toNum(d.declared);
                  });
              } catch {}
            }
          });

        const allKeys = new Set([
          ...Object.keys(methodsMap),
          ...Object.keys(shiftDeclared),
        ]);
        const payments = Array.from(allKeys)
          .map((key) => {
            const sys = methodsMap[key];
            const decl = shiftDeclared[key];
            return {
              description: sys?.description || decl?.description || key,
              code: sys?.code || null,
              amount: sys?.amount || 0,
              count: sys?.count || 0,
              declared: decl?.declared || 0,
              difference: Number(
                ((decl?.declared || 0) - (sys?.amount || 0)).toFixed(2),
              ),
            };
          })
          .sort((a, b) => b.amount - a.amount || b.declared - a.declared);

        return {
          shiftNo: group.shiftNo,
          employeeNames: [...new Set(group.employeeNames as string[])],
          hasPendingPresentation: Object.values(
            group.presentationStatus as Record<string, any>,
          ).some((ps: any) => !ps.isPresented),
          presentationStatus: Object.values(group.presentationStatus),
          payments,
        };
      })
      .sort((a: any, b: any) =>
        a.shiftNo.localeCompare(b.shiftNo, undefined, { numeric: true }),
      );
  }

  private computeDeclaredMap(shifts: any[]) {
    const declared: Record<string, any> = {};
    shifts.forEach((s: any) => {
      if (s.isPresented && s.presentationDetails) {
        try {
          const details =
            typeof s.presentationDetails === 'string'
              ? JSON.parse(s.presentationDetails)
              : s.presentationDetails;
          if (Array.isArray(details))
            details.forEach((d: any) => {
              const name = (d.name || 'Desconocido').toUpperCase().trim();
              if (!declared[name])
                declared[name] = { declared: 0, description: d.name };
              declared[name].declared += toNum(d.declared);
            });
        } catch {}
      }
    });
    return declared;
  }

  private mergePaymentsAndDeclared(
    methodsMap: Record<string, any>,
    declared: Record<string, any>,
  ) {
    const allKeys = new Set([
      ...Object.keys(methodsMap),
      ...Object.keys(declared),
    ]);
    return Array.from(allKeys)
      .map((key) => {
        const sys = methodsMap[key];
        const decl = declared[key];
        return {
          description: sys?.description || decl?.description || key,
          code: sys?.code || null,
          amount: sys?.amount || 0,
          count: sys?.count || 0,
          declared: decl?.declared || 0,
          difference: Number(
            ((decl?.declared || 0) - (sys?.amount || 0)).toFixed(2),
          ),
        };
      })
      .sort((a, b) => b.amount - a.amount || b.declared - a.declared);
  }
}
