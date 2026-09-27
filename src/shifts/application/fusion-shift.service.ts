import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IConnectionFactory } from '../../common/connections/connection-factory.interface';
import type { FusionRepository } from '../domain/ports/fusion-repository.interface';
import { computeValidationSummary } from '../../common/utils/shift-validation';
import type { DbExecutor } from '../../common/connections/db-executor.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FusionShiftService {
  private readonly logger = new Logger(FusionShiftService.name);

  constructor(
    @Inject('IConnectionFactory')
    private readonly connectionFactory: IConnectionFactory,
    @Inject('FusionRepository') private readonly fusionRepo: FusionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getFusionShiftDetails(storeCode: string, fsShiftIds: string) {
    this.logger.log(
      `getFusionShiftDetails store=${storeCode}, ids=${fsShiftIds}`,
    );
    if (!fsShiftIds) return { hoses: [], validationSummary: null };

    const ids = Array.from(
      new Set(
        fsShiftIds
          .split('|')
          .map((id) => id.trim())
          .filter((id) => id),
      ),
    );
    if (ids.length === 0) return { hoses: [], validationSummary: null };

    let fusionPool: DbExecutor | undefined;
    let tpvPool: DbExecutor | undefined;

    try {
      fusionPool = await this.connectionFactory.getFusionConnection(storeCode);
      tpvPool = await this.connectionFactory.getTpvConnection(storeCode);

      const fusionParams: Record<string, any> = {};
      const fusionPlaceholders = ids
        .map((id, i) => {
          fusionParams[`id${i}`] = id;
          return `@id${i}`;
        })
        .join(',');

      const fusionResult = await fusionPool.queryParams(
        `
        SELECT 
          numero_bomba as "Bomba", 
          numero_manguera as "Manguera", 
          numero_grado as "GradeNr",
          SUM(volumen) as "Vol. Total",
          SUM(monto) as "Monto Total",
          MIN(volumen_inicial) as "Vol. Inicial",
          MAX(volumen_final) as "Vol. Final"
        FROM ventas_combustible
        WHERE id_turno IN (${fusionPlaceholders}) OR CAST(id_venta AS TEXT) IN (${fusionPlaceholders})
        GROUP BY numero_bomba, numero_manguera, numero_grado
      `,
        fusionParams,
      );

      const tpvParams: Record<string, any> = {};
      const tpvPlaceholders = ids
        .map((id, i) => {
          tpvParams[`id${i}`] = id;
          return `@id${i}`;
        })
        .join(',');

      const tpvResult = await tpvPool.queryParams(
        `
        SELECT 
          lv.numero_bomba as "PumpId", 
          lv.posicion_bomba as "HoseId", 
          COALESCE(lv.cantidad, 0) as "Volume",
          COALESCE(lv.monto_con_isv, 0) as "Amount", 
          COALESCE(lv.monto_descuento_linea, lv.descuento, 0) as "Discount"
        FROM lineas_venta lv
        WHERE lv.id_transaccion_pos IN (${tpvPlaceholders})
      `,
        tpvParams,
      );

      const validationResult = await this.getValidationData(tpvPool, ids);
      const validationRecords = validationResult.map((r: any) => ({
        docType: Number(r['POS Sales Doc_ Type']),
        totalAmount: Number(r.TotalAmount) || 0,
        totalDiscount: Number(r.TotalDiscount) || 0,
      }));
      const validationSummary = computeValidationSummary(
        validationRecords,
        (r: any) => r.IsOtherProduct === 1,
      );

      const extraTickets = await this.getExtraTicketAmount(tpvPool, ids);
      if (extraTickets && validationSummary.tickets === 0) {
        validationSummary.tickets = extraTickets;
      }

      const hoses = await this.fusionRepo.findHosesByStore(storeCode);
      const hoseMap: Record<string, string> = {};
      hoses.forEach((h) => {
        if (h.pumpId !== null && h.hosePhysicalId !== null) {
          hoseMap[`${h.pumpId}-${h.hosePhysicalId}`] =
            h.gradeName || 'Producto';
        }
      });

      const aggregation = this.aggregateFusionData(
        fusionResult.recordset,
        tpvResult.recordset,
        hoseMap,
      );

      return {
        hoses: Object.values(aggregation).sort(
          (a: any, b: any) =>
            parseInt(a.pumpId, 10) - parseInt(b.pumpId, 10) ||
            parseInt(a.hoseId, 10) - parseInt(b.hoseId, 10),
        ),
        validationSummary,
      };
    } catch (error: any) {
      this.logger.error(
        `getFusionShiftDetails ERROR: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (fusionPool) await fusionPool.close().catch(() => {});
      if (tpvPool) await tpvPool.close().catch(() => {});
    }
  }

  async getAvailableDates(storeCode: string, limit: number = 150) {
    const tpvPool = await this.connectionFactory.getTpvConnection(storeCode);
    try {
      const result = await tpvPool.queryParams(
        `
        SELECT DISTINCT DATE(inicio_turno) as "ShiftDate"
        FROM turnos
        WHERE inicio_turno IS NOT NULL
        ORDER BY DATE(inicio_turno) DESC
        LIMIT @limit
      `,
        { limit },
      );
      return result.recordset.map(
        (row: any) => new Date(row.ShiftDate).toISOString().split('T')[0],
      );
    } finally {
      await tpvPool.close();
    }
  }

  async getShiftsByDate(storeCode: string, date: string) {
    const tpvPool = await this.connectionFactory.getTpvConnection(storeCode);
    try {
      const queryDate = new Date(date + 'T00:00:00Z');
      const queryDateStr = queryDate.toISOString().split('T')[0];
      const result = await tpvPool.queryParams(this.buildShiftsByDateQuery(), {
        date: queryDateStr,
      });

      if (result.recordset.length === 0) return [];

      const shifts = result.recordset;
      await this.enrichEmployeeNames(tpvPool, shifts);

      const boShifts = await this.prisma.boShift.findMany({
        where: {
          storeCode,
          shiftDate: new Date(queryDateStr),
        },
      });
      const boShiftMap = new Map();
      boShifts.forEach((bs) => {
        const key = `${bs.shiftNo}-${bs.employeeName.trim()}`;
        boShiftMap.set(key, bs);
      });

      return shifts.map((row: any) => {
        const empName = row.EmployeeName || row.EmployeeUsername;
        const key = `${row.ShiftNo}-${empName?.trim()}`;
        const boShift = boShiftMap.get(key);

        return {
          id: boShift?.id || row.ReconcilerShiftId?.toString(),
          shiftNo: row.ShiftNo?.toString(),
          shiftDate: row.ShiftDate,
          employeeName: row.EmployeeName,
          employeeUsername: row.EmployeeUsername,
          posCodes: row.pos_codes,
          fsShiftIds: row.fs_shift_ids,
          reconcilerShiftId: row.ReconcilerShiftId?.toString(),
          startTime: row.StartTime,
          endTime: row.EndTime,
          totalSale: Number(row.TotalSale || 0),
          status: row.EndTime ? 'CLOSED' : 'OPEN',
          auditStatus: boShift?.auditStatus || 'PENDING',
          auditedBy: boShift?.auditedBy || null,
          auditNotes: boShift?.auditNotes || null,
          auditedAt: boShift?.auditedAt ? boShift.auditedAt.toISOString() : null,
          cashVariance: boShift?.cashVariance != null ? Number(boShift.cashVariance) : null,
          fuelVariance: boShift?.fuelVariance != null ? Number(boShift.fuelVariance) : null,
          isLocked: Boolean(boShift?.isLocked),
          isPresented: Boolean(boShift?.isPresented),
        };
      });
    } catch (error: any) {
      this.logger.error(
        `Error in getShiftsByDate: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  private async getValidationData(pool: DbExecutor, ids: string[]) {
    const params: Record<string, any> = {};
    const placeholders = ids
      .map((id, i) => {
        params[`id${i}`] = id;
        return `@id${i}`;
      })
      .join(',');

    const result = await pool.queryParams(
      `
      SELECT 
        v.tipo_documento as "POS Sales Doc_ Type", 
        SUM(COALESCE(lv.monto_con_isv, 0)) as "TotalAmount",
        SUM(COALESCE(lv.monto_descuento_linea, lv.descuento, 0)) as "TotalDiscount",
        0 as "IsOtherProduct"
      FROM ventas v
      JOIN lineas_venta lv ON v.id_transaccion_pos = lv.id_transaccion_pos AND v.numero_emisor = lv.numero_emisor
      WHERE v.id_transaccion_pos IN (${placeholders})
      GROUP BY v.tipo_documento
    `,
      params,
    );
    return result.recordset;
  }

  private async getExtraTicketAmount(
    pool: DbExecutor,
    ids: string[],
  ): Promise<number> {
    const params: Record<string, any> = {};
    const placeholders = ids
      .map((id, i) => {
        params[`id${i}`] = id;
        return `@id${i}`;
      })
      .join(',');

    try {
      const result = await pool.queryParams(
        `
        SELECT SUM(COALESCE(pv.monto, 0)) as "TicketAmount"
        FROM pagos_venta pv
        WHERE pv.id_transaccion_pos IN (${placeholders}) AND pv.es_ticket = true
      `,
        params,
      );
      return result.recordset[0]?.TicketAmount
        ? Number(result.recordset[0].TicketAmount)
        : 0;
    } catch (e) {
      this.logger.warn(
        `Could not query extra ticket amounts: ${(e as Error).message}`,
      );
      return 0;
    }
  }

  private aggregateFusionData(
    fusionRows: any[],
    tpvRows: any[],
    hoseMap: Record<string, string>,
  ) {
    const aggregation: Record<string, any> = {};

    const getEntry = (pumpId: any, hoseId: any) => {
      const key = `${pumpId}-${hoseId}`;
      if (!aggregation[key]) {
        aggregation[key] = {
          pumpId,
          hoseId,
          displayHose: `${pumpId}${String.fromCharCode(64 + parseInt(hoseId, 10))}`,
          productName: hoseMap[key] || 'Producto',
          tpvVolume: 0,
          tpvAmount: 0,
          fusionVolume: 0,
          fusionAmount: 0,
          initialVolume: 0,
          finalVolume: 0,
        };
      }
      return aggregation[key];
    };

    fusionRows.forEach((row: any) => {
      const pumpId = row.Bomba;
      const manguera = row.Manguera ? row.Manguera.toString() : '';
      let hoseId = 1;
      if (manguera.match(/[A-Z]$/))
        hoseId = manguera.slice(-1).charCodeAt(0) - 64;
      else if (manguera.match(/^\d+$/)) hoseId = parseInt(manguera, 10);

      const entry = getEntry(pumpId, hoseId);
      entry.displayHose = manguera || entry.displayHose;
      entry.productName = row.GradeNames || entry.productName;
      entry.fusionVolume = Number(row['Vol. Total'] || 0);
      entry.fusionAmount = Number(row['Monto Total'] || 0);
      entry.initialVolume = Number(row['Vol. Inicial'] || 0);
      entry.finalVolume = Number(row['Vol. Final'] || 0);
    });

    tpvRows.forEach((row: any) => {
      const entry = getEntry(row.PumpId, row.HoseId);
      entry.tpvVolume += Number(row.Volume || 0);
      entry.tpvAmount += Number(row.Amount || 0) + Number(row.Discount || 0);
    });

    Object.values(aggregation).forEach((entry: any) => {
      entry.diffVolume = entry.tpvVolume - entry.fusionVolume;
      entry.diffAmount = entry.tpvAmount - entry.fusionAmount;
    });

    return aggregation;
  }

  private buildShiftsByDateQuery() {
    return `
      SELECT 
        COALESCE(t.turno, '1') as "ShiftNo", 
        COALESCE(t.nombre_empleado, 'Desconocido') as "EmployeeUsername",
        COALESCE(t.nombre_empleado, 'Desconocido') as "EmployeeName", 
        t.id_transaccion_pos as "ReconcilerShiftId",
        DATE(t.inicio_turno) as "ShiftDate", 
        MIN(t.inicio_turno) as "StartTime",
        MAX(t.fin_turno) as "EndTime",
        COALESCE(SUM(v.monto), 0) as "TotalSale",
        COALESCE(STRING_AGG(DISTINCT t.codigo_pos, ' | '), '') as pos_codes,
        COALESCE(STRING_AGG(DISTINCT t.id_transaccion_pos, ' | '), '') as fs_shift_ids
      FROM turnos t
      LEFT JOIN ventas v ON t.id_transaccion_pos = v.id_transaccion_pos
      WHERE DATE(t.inicio_turno) = DATE(@date)
      GROUP BY COALESCE(t.turno, '1'), t.nombre_empleado, t.id_transaccion_pos, DATE(t.inicio_turno)
      ORDER BY COALESCE(t.turno, '1'), t.nombre_empleado
    `;
  }

  private async enrichEmployeeNames(pool: DbExecutor, shifts: any[]) {
    const usernamesToEnrich: string[] = Array.from(
      new Set(
        shifts
          .filter(
            (s: any) =>
              s.EmployeeName === s.EmployeeUsername || !s.EmployeeName,
          )
          .map((s: any) => s.EmployeeUsername as string),
      ),
    );
    if (usernamesToEnrich.length === 0) return;

    const nameMap = new Map<string, string>();

    try {
      const empParams: Record<string, any> = {};
      const empPlaceholders = usernamesToEnrich
        .map((u: string, i: number) => {
          empParams[`u${i}`] = u;
          return `@u${i}`;
        })
        .join(',');
      const empResult = await pool.queryParams(
        `SELECT usuario as "Usuario", nombre as "Nombre" FROM empleados WHERE usuario IN (${empPlaceholders})`,
        empParams,
      );
      empResult.recordset.forEach((r: any) => nameMap.set(r.Usuario, r.Nombre));
    } catch (e) {
      this.logger.warn(`Error querying empleados: ${(e as Error).message}`);
    }

    for (const s of shifts) {
      if (nameMap.has(s.EmployeeUsername)) {
        s.EmployeeName = nameMap.get(s.EmployeeUsername);
      }
    }
  }

  async getUnifiedPayments(storeCode: string, fsShiftIds: string) {
    if (!fsShiftIds) return [];
    const ids = Array.from(
      new Set(
        fsShiftIds
          .split('|')
          .map((id) => id.trim())
          .filter((id) => id),
      ),
    );
    if (ids.length === 0) return [];

    let tpvPool: DbExecutor | undefined;
    try {
      tpvPool = await this.connectionFactory.getTpvConnection(storeCode);
      const params: Record<string, any> = {};
      const placeholders = ids
        .map((id, i) => {
          params[`id${i}`] = id;
          return `@id${i}`;
        })
        .join(',');

      const res = await tpvPool.queryParams(
        `
        SELECT 
          pv.codigo_metodo_pago as "paymentMethod",
          pv.descripcion as "description",
          SUM(COALESCE(pv.monto, 0)) as "amount"
        FROM pagos_venta pv
        WHERE pv.id_transaccion_pos IN (${placeholders})
        GROUP BY pv.codigo_metodo_pago, pv.descripcion
        ORDER BY pv.codigo_metodo_pago
      `,
        params,
      );
      return res.recordset.map((r: any) => ({
        paymentMethod: r.paymentMethod,
        description: r.description,
        amount: Number(r.amount) || 0,
      }));
    } finally {
      if (tpvPool) await tpvPool.close().catch(() => {});
    }
  }

  async auditShift(id: string, auditData: any) {
    this.logger.log(`Auditing shift ${id}: status=${auditData.auditStatus}`);
    
    // Check if shift exists in boShift by id or reconcilerShiftId
    const existing = await this.prisma.boShift.findFirst({
      where: {
        OR: [
          { id },
          { reconcilerShiftId: id },
        ],
      },
    });

    if (!existing) {
      return { success: false, error: 'Turno no encontrado en la base de datos de auditoría' };
    }

    const updated = await this.prisma.boShift.update({
      where: { id: existing.id },
      data: {
        auditStatus: auditData.auditStatus || 'AUDITED',
        auditedBy: auditData.auditedBy || 'Administrador',
        auditNotes: auditData.auditNotes || null,
        auditedAt: new Date(),
        cashVariance: auditData.cashVariance != null ? Number(auditData.cashVariance) : existing.cashVariance,
        fuelVariance: auditData.fuelVariance != null ? Number(auditData.fuelVariance) : existing.fuelVariance,
        isLocked: auditData.isLocked != null ? Boolean(auditData.isLocked) : true,
      },
    });

    return { success: true, shift: updated };
  }
}
