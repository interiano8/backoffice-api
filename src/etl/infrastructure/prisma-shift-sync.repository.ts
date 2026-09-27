import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDate } from '../../common/utils/date-utils';
import { ETL } from '../../common/utils/constants';
import type { DbExecutor } from '../../common/connections/db-executor.interface';

@Injectable()
export class PrismaShiftSyncRepository {
  private readonly logger = new Logger(PrismaShiftSyncRepository.name);

  constructor(private prisma: PrismaService) {}

  async syncTpvShifts(
    pool: DbExecutor,
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void> {
    let startDate: Date = new Date(0);
    if (!reconcilerShiftId && !specificDate) {
      const lastShift = await this.prisma.boShift.findFirst({
        where: { storeCode },
        orderBy: { shiftDate: 'desc' },
        select: { shiftDate: true },
      });
      const defaultLookback = new Date();
      defaultLookback.setDate(
        defaultLookback.getDate() - ETL.DEFAULT_LOOKBACK_DAYS,
      );
      startDate = lastShift
        ? new Date(lastShift.shiftDate.getTime() - 60 * 60 * 1000)
        : defaultLookback;
    }

    const { sql, params } = this.buildShiftQuery(
      reconcilerShiftId,
      specificDate,
      startDate,
    );
    const result = await pool.queryParams(sql, params);

    for (const row of result.recordset) {
      const officialEnd = row.OfficialEndTime
        ? new Date(row.OfficialEndTime)
        : null;
      const status = officialEnd ? 'CLOSED' : 'OPEN';
      if (!row['Shift Date'] || !row['Shift No_'] || !row['EmployeeName'])
        continue;

      const shiftDate = normalizeDate(row['Shift Date']) as Date;
      const shiftNo = row['Shift No_']?.toString() || '1';
      const employeeName = row['EmployeeName'];

      const existing = await this.prisma.boShift.findUnique({
        where: {
          source_storeCode_shiftDate_shiftNo_employeeName: {
            source: 'TPV',
            storeCode,
            shiftDate,
            shiftNo,
            employeeName,
          },
        },
        select: { status: true },
      });

      if (existing?.status === 'CLOSED') {
        continue;
      }

      await this.prisma.boShift.upsert({
        where: {
          source_storeCode_shiftDate_shiftNo_employeeName: {
            source: 'TPV',
            storeCode,
            shiftDate,
            shiftNo,
            employeeName,
          },
        },
        update: {
          endTime: officialEnd,
          status,
          startTime: new Date(row.StartTime || new Date()),
          posCodes: row.pos_codes,
          reconcilerShiftId: row.reconciler_shifts,
          invoiceCashCount: Number(row.InvoiceCashCount) || 0,
          invoiceCreditCount: Number(row.InvoiceCreditCount) || 0,
          creditNoteCount: Number(row.CreditNoteCount) || 0,
          outflowCount: Number(row.OutflowCount) || 0,
          fsShiftIds: row.fs_shift_ids || null,
        },
        create: {
          source: 'TPV',
          storeCode,
          shiftDate,
          shiftNo,
          employeeName,
          startTime: new Date(row.StartTime || new Date()),
          endTime: officialEnd,
          status,
          posCodes: row.pos_codes,
          reconcilerShiftId: row.reconciler_shifts,
          invoiceCashCount: Number(row.InvoiceCashCount) || 0,
          invoiceCreditCount: Number(row.InvoiceCreditCount) || 0,
          creditNoteCount: Number(row.CreditNoteCount) || 0,
          outflowCount: Number(row.OutflowCount) || 0,
          fsShiftIds: row.fs_shift_ids || null,
        },
      });
    }
    this.logger.log(
      `Synced ${result.recordset.length} Shifts for store ${storeCode}`,
    );
  }

  async updateShiftTotals(
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void> {
    const where: any = {
      storeCode,
      shiftNo: { not: null },
      shiftDate: { not: null },
      attendantName: { not: null },
    };
    if (reconcilerShiftId) where.reconcilerShiftId = reconcilerShiftId;
    else if (specificDate) where.shiftDate = specificDate;

    const totals = await this.prisma.boSale.groupBy({
      by: ['shiftNo', 'shiftDate', 'attendantName'],
      where,
      _sum: { amount: true, discount: true },
    });

    for (const t of totals) {
      if (!t.shiftNo || !t.shiftDate || !t.attendantName) continue;
      await this.prisma.boShift.updateMany({
        where: {
          source: 'TPV',
          storeCode,
          shiftNo: t.shiftNo,
          shiftDate: t.shiftDate,
          employeeName: t.attendantName,
        },
        data: {
          totalSale: t._sum.amount || 0,
          totalDiscount: t._sum.discount || 0,
        },
      });
    }
    this.logger.log(
      `Updated totals for ${totals.length} shifts in store ${storeCode}`,
    );
  }

  private buildShiftQuery(
    reconcilerShiftId?: string,
    specificDate?: Date,
    startDate?: Date,
  ): { sql: string; params: Record<string, any> } {
    const params: Record<string, any> = {};
    let whereClause: string;

    if (reconcilerShiftId) {
      whereClause = 't.id_transaccion_pos = @reconcilerShiftId';
      params.reconcilerShiftId = reconcilerShiftId;
    } else if (specificDate) {
      whereClause = 'DATE(t.inicio_turno) = DATE(@specificDate)';
      params.specificDate = specificDate.toISOString().split('T')[0];
    } else {
      whereClause = 't.inicio_turno >= @startDate';
      params.startDate = (startDate || new Date(0)).toISOString();
    }

    const sql = `
      SELECT 
        DATE(t.inicio_turno) as "Shift Date",
        COALESCE(t.turno, '1') as "Shift No_",
        COALESCE(t.nombre_empleado, 'Desconocido') as "EmployeeName",
        MIN(t.inicio_turno) as "StartTime",
        MAX(t.fin_turno) as "OfficialEndTime",
        COALESCE(STRING_AGG(DISTINCT t.codigo_pos, ' | '), '') as pos_codes,
        COALESCE(STRING_AGG(DISTINCT t.id_transaccion_pos, ' | '), '') as reconciler_shifts,
        '' as fs_shift_ids,
        COUNT(CASE WHEN v.tipo_documento = 1 THEN 1 END) as "InvoiceCashCount",
        COUNT(CASE WHEN v.tipo_documento = 2 THEN 1 END) as "InvoiceCreditCount",
        COUNT(CASE WHEN v.tipo_documento = 3 THEN 1 END) as "CreditNoteCount",
        COUNT(CASE WHEN v.tipo_documento = 7 THEN 1 END) as "OutflowCount"
      FROM turnos t
      LEFT JOIN ventas v ON t.id_transaccion_pos = v.id_transaccion_pos
      WHERE ${whereClause}
      GROUP BY DATE(t.inicio_turno), COALESCE(t.turno, '1'), COALESCE(t.nombre_empleado, 'Desconocido')
    `;

    return { sql, params };
  }
}
