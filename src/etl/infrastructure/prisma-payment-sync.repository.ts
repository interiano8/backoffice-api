import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDate } from '../../common/utils/date-utils';
import { ETL } from '../../common/utils/constants';
import type { DbExecutor } from '../../common/connections/db-executor.interface';

@Injectable()
export class PrismaPaymentSyncRepository {
  private readonly logger = new Logger(PrismaPaymentSyncRepository.name);

  constructor(private prisma: PrismaService) {}

  async syncPaymentMethods(
    pool: DbExecutor,
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void> {
    let startDate: Date = new Date(0);
    if (!reconcilerShiftId && !specificDate) {
      const lastPayment = await this.prisma.boPaymentMethod.findFirst({
        where: { storeCode },
        orderBy: { shiftDate: 'desc' },
        select: { shiftDate: true },
      });
      const defaultLookback = new Date();
      defaultLookback.setDate(
        defaultLookback.getDate() - ETL.DEFAULT_LOOKBACK_DAYS,
      );
      startDate = lastPayment
        ? new Date(lastPayment.shiftDate.getTime() - 60 * 60 * 1000)
        : defaultLookback;
    }

    const params: Record<string, any> = {};
    let whereClause: string;
    if (reconcilerShiftId) {
      params.reconcilerShiftId = reconcilerShiftId;
      whereClause = 'WHERE pv.id_transaccion_pos = @reconcilerShiftId';
    } else if (specificDate) {
      params.specificDate = specificDate.toISOString().split('T')[0];
      whereClause = 'WHERE DATE(COALESCE(t.inicio_turno, v.fecha_hora_venta)) = DATE(@specificDate)';
    } else {
      params.startDate = startDate.toISOString();
      whereClause = 'WHERE COALESCE(t.inicio_turno, v.fecha_hora_venta) >= @startDate';
    }

    const query = `
      SELECT 
        pv.id_transaccion_pos as "TransactionId", 
        pv.numero_linea_pago as "ChargeLineNo",
        COALESCE(pv.codigo_metodo_pago, 'EFECTIVO') as "ChargeMethodCode", 
        COALESCE(pv.descripcion, 'Sin Descripcion') as "Description", 
        COALESCE(pv.monto, 0) as "AmountVal",
        pv.numero_tarjeta as "PaymentCardNo", 
        pv.datos_adicionales as "AdditionalData", 
        pv.es_ticket as "EsTicket",
        DATE(COALESCE(t.inicio_turno, v.fecha_hora_venta)) as "ShiftDate", 
        COALESCE(t.turno, '1') as "ShiftNo", 
        COALESCE(t.nombre_empleado, v.codigo_vendedor, 'Desconocido') as "EmployeeName",
        pv.id_transaccion_pos as "ReconcilerShiftId"
      FROM pagos_venta pv
      LEFT JOIN ventas v ON pv.id_transaccion_pos = v.id_transaccion_pos
      LEFT JOIN turnos t ON pv.id_transaccion_pos = t.id_transaccion_pos
      ${whereClause}
    `;

    const result = await pool.queryParams(query, params);

    const validRecords = result.recordset.map((row: any) => ({
      source: 'TPV',
      storeCode,
      transactionId: row.TransactionId?.toString(),
      chargeLineNo: Number(row.ChargeLineNo) || 0,
      shiftDate: normalizeDate(row.ShiftDate) as Date,
      shiftNo: row.ShiftNo?.toString() || '1',
      employeeName: row.EmployeeName || 'Desconocido',
      chargeMethodCode: row.ChargeMethodCode?.toString() || 'EFECTIVO',
      description: row.Description || 'Sin Descripcion',
      amount: Number(row.AmountVal) || 0,
      paymentCardNo: row.PaymentCardNo || null,
      additionalData: row.AdditionalData || null,
      esTicket: Boolean(row.EsTicket),
      reconcilerShiftId: row.ReconcilerShiftId?.toString() || null,
    }));

    const filterTransactionIds = [
      ...new Set(validRecords.map((r) => r.transactionId).filter(Boolean)),
    ] as string[];
    const validTransactionIds = new Set<string>();

    for (let i = 0; i < filterTransactionIds.length; i += ETL.CHUNK_SIZE) {
      const chunk = filterTransactionIds.slice(i, i + 1000);
      const headers = await this.prisma.boSaleHeader.findMany({
        where: { source: 'TPV', storeCode, transactionId: { in: chunk } },
        select: { transactionId: true },
      });
      headers.forEach((h) => validTransactionIds.add(h.transactionId));
    }

    const filteredRecords = validRecords.filter((r) =>
      validTransactionIds.has(r.transactionId),
    );
    const reconcilerShiftIds: string[] = [
      ...new Set(
        filteredRecords.map((r) => r.reconcilerShiftId).filter(Boolean),
      ),
    ] as string[];

    if (reconcilerShiftIds.length > 0) {
      for (let i = 0; i < reconcilerShiftIds.length; i += ETL.CHUNK_SIZE) {
        const chunk = reconcilerShiftIds.slice(i, i + 1000);
        await this.prisma.boPaymentMethod.deleteMany({
          where: { storeCode, reconcilerShiftId: { in: chunk } },
        });
      }
    }

    if (filteredRecords.length > 0) {
      for (let i = 0; i < filteredRecords.length; i += ETL.CHUNK_SIZE) {
        const chunk = filteredRecords.slice(i, i + 1000);
        await this.prisma.boPaymentMethod.createMany({ data: chunk as any });
      }
    }
    this.logger.log(
      `Synced ${validRecords.length} payment method records for store ${storeCode}`,
    );
  }
}
