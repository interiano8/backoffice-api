import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IConnectionFactory } from '../../common/connections/connection-factory.interface';
import type { CtrlRepository } from '../domain/ports/ctrl-repository.interface';
import { computeValidationSummary } from '../../common/utils/shift-validation';

@Injectable()
export class CtrlTpvRepository implements CtrlRepository {
  private readonly logger = new Logger(CtrlTpvRepository.name);

  constructor(
    @Inject('IConnectionFactory')
    private readonly connectionFactory: IConnectionFactory,
  ) {}

  async getRecentSales(storeCode: string, filters: any = {}) {
    let fusionPool: any | null = null;
    try {
      const productMap = await this.getProductMapping(storeCode);
      fusionPool = await this.getFusionConnection(storeCode);

      const whereClauses: string[] = [];
      const params: Record<string, any> = {};
      const hasShiftLimiter =
        filters.shiftId ||
        filters.startDate ||
        filters.endDate ||
        filters.saleId;

      if (filters.startDate)
        this.addDateFilter(
          params,
          whereClauses,
          'startDate',
          filters.startDate,
        );
      if (filters.endDate)
        this.addDateFilter(params, whereClauses, 'endDate', filters.endDate);
      if (filters.shiftId) {
        params.shiftId = String(filters.shiftId);
        whereClauses.push('id_turno = @shiftId');
      }
      if (filters.posNumber && !isNaN(parseInt(filters.posNumber, 10))) {
        params.posNumber = parseInt(filters.posNumber, 10);
        whereClauses.push('numero_pos = @posNumber');
      }
      if (filters.pumpNumber && !isNaN(parseInt(filters.pumpNumber, 10))) {
        params.pumpNumber = parseInt(filters.pumpNumber, 10);
        whereClauses.push('numero_bomba = @pumpNumber');
      }
      if (filters.saleId && !isNaN(parseInt(filters.saleId, 10))) {
        params.saleId = parseInt(filters.saleId, 10);
        whereClauses.push('id_venta = @saleId');
      }
      if (filters.minAmount && !isNaN(parseFloat(filters.minAmount))) {
        params.minAmount = parseFloat(filters.minAmount);
        whereClauses.push('monto >= @minAmount');
      }
      if (filters.maxAmount && !isNaN(parseFloat(filters.maxAmount))) {
        params.maxAmount = parseFloat(filters.maxAmount);
        whereClauses.push('monto <= @maxAmount');
      }

      if (!hasShiftLimiter) {
        whereClauses.push(
          'id_turno = (SELECT id_turno FROM ventas_combustible WHERE id_turno IS NOT NULL ORDER BY id_venta DESC LIMIT 1)',
        );
      }

      const whereSql =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const result = await fusionPool.queryParams(
        `
        SELECT 
          id_venta as "SaleID",
          numero_pos as "PosNumber",
          numero_bomba as "PumpNumber",
          numero_manguera as "HoseNumber",
          monto as "Amount",
          precio_unitario as "PPU",
          volumen as "Volume",
          volumen_final as "FinalVolumeTotal",
          volumen_inicial as "InitialVolumeTotal",
          temperatura_compensada as "CompensatedTemperature",
          id_turno as "ShiftID",
          numero_grado as "GradeNr",
          nivel_precio as "PriceLevel",
          tipo_transaccion as "TypeOfTransaction",
          fecha_transaccion as "DateOfTransaction",
          hora_transaccion as "TimeOfTransaction",
          monto_preestablecido as "PresetAmount",
          facturada as "IsInvoiced"
        FROM ventas_combustible
        ${whereSql}
        ORDER BY id_venta DESC
        LIMIT 200
      `,
        params,
      );

      return result.recordset.map((row: any) => {
        const productName =
          productMap[row.GradeNr] || `Producto ${row.GradeNr}`;
        let formattedDateTime = '';
        if (row.DateOfTransaction != null && row.TimeOfTransaction != null) {
          const d = String(row.DateOfTransaction).trim();
          const t = String(row.TimeOfTransaction).padStart(6, '0').trim();
          if (d.length >= 8 && t.length >= 6) {
            formattedDateTime = `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)} ${t.substring(0, 2)}:${t.substring(2, 4)}`;
          }
        }
        return {
          ...row,
          productName,
          formattedDateTime,
          displayPos: row.PosNumber === 99 ? '-' : row.PosNumber,
        };
      });
    } catch (error: any) {
      this.logger.error(
        `Error fetching recent sales: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (fusionPool) await fusionPool.close();
    }
  }

  async getShiftValidation(storeCode: string, shiftId: string) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);

      const result = await tpvPool.queryParams(
        `
          SELECT 
            v.tipo_documento as "POS Sales Doc_ Type", 
            SUM(COALESCE(lv.monto_con_isv, 0)) as "TotalAmount",
            SUM(COALESCE(lv.monto_descuento_linea, lv.descuento, 0)) as "TotalDiscount"
          FROM ventas v
          JOIN lineas_venta lv ON v.id_transaccion_pos = lv.id_transaccion_pos AND v.numero_emisor = lv.numero_emisor
          WHERE v.id_transaccion_pos = @shiftId OR v.id_transaccion_pos IN (SELECT id_transaccion_pos FROM turnos WHERE turno = @shiftId)
          GROUP BY v.tipo_documento
        `,
        { shiftId },
      );

      const validationRecords = result.recordset.map((row: any) => ({
        docType: Number(row['POS Sales Doc_ Type']),
        totalAmount: Number(row.TotalAmount) || 0,
        totalDiscount: Number(row.TotalDiscount) || 0,
      }));
      const summary = computeValidationSummary(validationRecords);

      try {
        const ticketResult = await tpvPool.queryParams(
          `
            SELECT SUM(COALESCE(pv.monto, 0)) as "TicketAmount"
            FROM pagos_venta pv
            WHERE pv.id_transaccion_pos = @shiftId AND pv.es_ticket = true
          `,
          { shiftId },
        );
        if (ticketResult.recordset[0]?.TicketAmount && summary.tickets === 0) {
          summary.tickets = Number(ticketResult.recordset[0].TicketAmount);
        }
      } catch (e: any) {
        this.logger.warn(`Could not query extra ticket amounts: ${e.message}`);
      }

      return summary;
    } catch (error: any) {
      this.logger.error(
        `Error fetching shift validation: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  private async getProductMapping(storeCode: string) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const result = await tpvPool.query(
        'SELECT numero_grado as "GradeNumber", codigo_generico as "CodigoGenerico" FROM mangueras',
      );
      const mapping: Record<number, string> = {};
      result.recordset.forEach((row: any) => {
        mapping[row.GradeNumber] = row.CodigoGenerico?.trim();
      });
      return mapping;
    } catch (error: any) {
      this.logger.warn(`Could not fetch product mapping: ${error.message}`);
      return {};
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  private addDateFilter(
    params: Record<string, any>,
    clauses: string[],
    prefix: string,
    date: string,
  ) {
    const compact = date.replace(/-/g, '');
    params[prefix] = date;
    params[`${prefix}Compact`] = compact;
    clauses.push(
      `(fecha_transaccion = @${prefix} OR fecha_transaccion = @${prefix}Compact OR DATE(fecha) = DATE(@${prefix}))`,
    );
  }

  private getTpvConnection(storeCode: string) {
    return this.connectionFactory.getTpvConnection(storeCode);
  }
  private getFusionConnection(storeCode: string) {
    return this.connectionFactory.getFusionConnection(storeCode);
  }
}
