import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDate } from '../../common/utils/date-utils';
import { ETL } from '../../common/utils/constants';
import type { DbExecutor } from '../../common/connections/db-executor.interface';

@Injectable()
export class PrismaSaleSyncRepository {
  private readonly logger = new Logger(PrismaSaleSyncRepository.name);

  constructor(private prisma: PrismaService) {}

  async syncSaleHeaders(
    pool: DbExecutor,
    storeCode: string,
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void> {
    let startDate: Date = new Date(0);
    if (!reconcilerShiftId && !specificDate) {
      const lastHeader = await this.prisma.boSaleHeader.findFirst({
        where: { storeCode },
        orderBy: { shiftDate: 'desc' },
        select: { shiftDate: true },
      });
      const defaultLookback = new Date();
      defaultLookback.setDate(
        defaultLookback.getDate() - ETL.DEFAULT_LOOKBACK_DAYS,
      );
      startDate = lastHeader
        ? new Date(lastHeader.shiftDate.getTime() - 6 * 60 * 60 * 1000)
        : defaultLookback;
    }

    const params: Record<string, any> = {};
    let whereClause: string;
    if (reconcilerShiftId) {
      whereClause = 'WHERE v.id_transaccion_pos = @reconcilerShiftId';
      params.reconcilerShiftId = reconcilerShiftId;
    } else if (specificDate) {
      whereClause = 'WHERE DATE(COALESCE(t.inicio_turno, v.fecha_hora_venta)) = DATE(@specificDate)';
      params.specificDate = specificDate.toISOString().split('T')[0];
    } else {
      whereClause = 'WHERE COALESCE(t.inicio_turno, v.fecha_hora_venta) >= @startDate';
      params.startDate = startDate.toISOString();
    }

    const query = `
      SELECT DISTINCT 
        v.id_transaccion_pos as "TransactionId", 
        COALESCE(v.tipo_documento, 1) as "DocType",
        COALESCE(v.numero_documento, '') as "DocNo", 
        v.documento_relacionado as "AppliedDocNo",
        DATE(COALESCE(t.inicio_turno, v.fecha_hora_venta)) as "ShiftDate", 
        COALESCE(t.turno, '1') as "ShiftNo", 
        COALESCE(t.nombre_empleado, v.codigo_vendedor, 'Desconocido') as "AttendantName",
        v.nombre_cliente as "CustomerName", 
        v.codigo_cliente as "CustomerId", 
        v.rtn_cliente as "RTN",
        COALESCE(v.subtotal, 0) as "SubTotal", 
        COALESCE(v.monto, 0) as "TotalAmount", 
        v.kilometraje as "KM", 
        v.orden as "Orden",
        v.placa as "Placa", 
        v.chofer as "Chofer", 
        v.id_transaccion_pos as "ReconcilerShiftId"
      FROM ventas v
      LEFT JOIN turnos t ON v.id_transaccion_pos = t.id_transaccion_pos
      ${whereClause}
    `;

    const result = await pool.queryParams(query, params);
    if (result.recordset.length === 0) return;

    const newRecords = result.recordset.map((row: any) => ({
      source: 'TPV',
      storeCode,
      transactionId: row.TransactionId?.toString(),
      docType: Number(row.DocType) || 1,
      docNo: row.DocNo || '',
      shiftDate: normalizeDate(row.ShiftDate) as Date,
      shiftNo: row.ShiftNo?.toString() || '1',
      employeeName: row.AttendantName || 'Desconocido',
      customerNo: row.CustomerId || null,
      customerName: row.CustomerName || null,
      rtn: row.RTN || null,
      subTotal: Number(row.SubTotal) || 0,
      totalAmount: Number(row.TotalAmount) || 0,
      km: row.KM || null,
      orden: row.Orden || null,
      placa: row.Placa || null,
      chofer: row.Chofer || null,
      reconcilerShiftId: row.ReconcilerShiftId?.toString() || null,
      appliedDocNo: row.AppliedDocNo?.toString() || null,
    }));

    const uniqueRecords = Array.from(
      new Map(newRecords.map((r: any) => [r.transactionId, r])).values(),
    );
    const transactionIds = uniqueRecords.map((r: any) => r.transactionId);

    const existingIdsSet = new Set<string>();
    if (transactionIds.length > 0) {
      for (let i = 0; i < transactionIds.length; i += ETL.CHUNK_SIZE) {
        const chunk = transactionIds.slice(i, i + 1000);
        const existing = await this.prisma.boSaleHeader.findMany({
          where: { source: 'TPV', storeCode, transactionId: { in: chunk } },
          select: { transactionId: true },
        });
        existing.forEach((e: any) => existingIdsSet.add(e.transactionId));
      }
    }

    const toCreate = uniqueRecords.filter(
      (r: any) => !existingIdsSet.has(r.transactionId),
    );
    if (toCreate.length > 0) {
      this.logger.log(`Bulk inserting ${toCreate.length} new sale headers...`);
      await this.prisma.boSaleHeader.createMany({ data: toCreate as any });
    }

    const toUpdate = uniqueRecords.filter((r: any) =>
      existingIdsSet.has(r.transactionId),
    );
    if (toUpdate.length > 0) {
      for (const record of toUpdate) {
        await this.prisma.boSaleHeader.updateMany({
          where: {
            source: 'TPV',
            storeCode,
            transactionId: record.transactionId,
            appliedDocNo: null,
          },
          data: { appliedDocNo: record.appliedDocNo },
        });
      }
    }
    this.logger.log(
      `Synced ${result.recordset.length} Sale Headers for store ${storeCode}`,
    );
  }

  async syncTpvSales(
    pool: DbExecutor,
    storeCode: string,
    configMaps: any = { hoseMap: {}, productMap: {} },
    specificDate?: Date,
    reconcilerShiftId?: string,
  ): Promise<void> {
    let startDate: Date = new Date(0);
    if (!reconcilerShiftId && !specificDate) {
      const lastSale = await this.prisma.boSale.findFirst({
        where: { storeCode },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });
      const defaultLookback = new Date();
      defaultLookback.setDate(
        defaultLookback.getDate() - ETL.DEFAULT_LOOKBACK_DAYS,
      );
      startDate = lastSale
        ? new Date(lastSale.timestamp.getTime() - 60 * 60 * 1000)
        : defaultLookback;
    }

    const saleParams: Record<string, any> = {};
    let whereClause: string;
    if (reconcilerShiftId) {
      saleParams.reconcilerShiftId = reconcilerShiftId;
      whereClause = 'WHERE v.id_transaccion_pos = @reconcilerShiftId';
    } else if (specificDate) {
      saleParams.specificDate = specificDate.toISOString().split('T')[0];
      whereClause = 'WHERE DATE(COALESCE(t.inicio_turno, v.fecha_hora_venta)) = DATE(@specificDate)';
    } else {
      saleParams.startDate = startDate.toISOString();
      whereClause = 'WHERE COALESCE(t.inicio_turno, v.fecha_hora_venta) >= @startDate';
    }

    const query = `
      SELECT 
        v.id_transaccion_pos as "ExternalId", 
        COALESCE(lv.hora_operacion, v.fecha_hora_venta) as "Timestamp",
        DATE(COALESCE(t.inicio_turno, v.fecha_hora_venta)) as "ShiftDate", 
        COALESCE(t.turno, '1') as "ShiftNo", 
        COALESCE(t.nombre_empleado, v.codigo_vendedor, 'Desconocido') as "AttendantName",
        lv.numero_linea_documento as "LineNumber", 
        lv.descripcion as "Description",
        COALESCE(lv.cantidad, 0) as "Volume", 
        COALESCE(lv.precio_unitario_con_isv, 0) as "Price",
        COALESCE(lv.monto_con_isv, 0) as "Amount", 
        COALESCE(lv.monto_descuento_linea, lv.descuento, 0) as "Discount",
        COALESCE(lv.descuento, 0) as "DiscountPct", 
        lv.numero_bomba as "PumpId", 
        lv.posicion_bomba as "HoseId",
        lv.numero_tanque as "TankId", 
        lv.id_venta as "SaleIdFusion", 
        v.id_transaccion_pos as "ReconcilerShiftId",
        v.nombre_cliente as "CustomerName", 
        v.codigo_cliente as "CustomerId", 
        v.tipo_documento as "DocType",
        v.documento_relacionado as "AppliedDocNo", 
        CAST(v.tipo_facturacion AS TEXT) as "POSSalesType",
        CASE WHEN lv.numero_bomba IS NOT NULL THEN lv.monto_con_isv ELSE NULL END as "fsAmount", 
        CASE WHEN lv.numero_bomba IS NOT NULL THEN lv.precio_unitario_con_isv ELSE NULL END as "fsPPU", 
        CASE WHEN lv.numero_bomba IS NOT NULL THEN lv.cantidad ELSE NULL END as "fsVolume", 
        NULL as "fsFinalVolume", 
        NULL as "fsInitialVolume", 
        NULL as "fsShiftId"
      FROM ventas v
      JOIN lineas_venta lv ON v.id_transaccion_pos = lv.id_transaccion_pos AND v.numero_emisor = lv.numero_emisor
      LEFT JOIN turnos t ON v.id_transaccion_pos = t.id_transaccion_pos
      ${whereClause}
    `;

    const result = await pool.queryParams(query, saleParams);

    const validRecords = result.recordset.map((row: any) => {
      const hoseLetter = row.HoseId;
      let mappedHoseId = '1';
      if (hoseLetter === 'A') mappedHoseId = '1';
      else if (hoseLetter === 'B') mappedHoseId = '2';
      else if (hoseLetter === 'C') mappedHoseId = '3';
      else if (hoseLetter === 'D') mappedHoseId = '4';
      if (
        !['A', 'B', 'C', 'D'].includes(hoseLetter) &&
        !isNaN(parseInt(hoseLetter, 10))
      )
        mappedHoseId = hoseLetter;

      const configKey = `${row.PumpId}-${mappedHoseId}`;
      const config = configMaps.hoseMap[configKey];
      const rawDescription = (row.Description || '').toUpperCase().trim();
      const productConfig =
        configMaps.productMap[rawDescription] ||
        configMaps.productMap[config?.grade?.toUpperCase()];

      return {
        source: 'TPV',
        storeCode,
        externalId: row.ExternalId?.toString(),
        lineNo: Number(row.LineNumber) || 0,
        saleIdFusion: row.SaleIdFusion?.toString() || null,
        timestamp: new Date(row.Timestamp || new Date()),
        shiftNo: row.ShiftNo?.toString() || '1',
        shiftDate: normalizeDate(row.ShiftDate) as Date,
        attendantName: row.AttendantName || 'Desconocido',
        customerName: row.CustomerName || null,
        customerId: row.CustomerId || null,
        docType: Number(row.DocType) || 1,
        amount: Number(row.Amount) || 0,
        volume: Number(row.Volume) || 0,
        unitPrice: Number(row.Price) || 0,
        discount: Number(row.Discount) || 0,
        discountPct: Number(row.DiscountPct) || 0,
        paymentType: row.POSSalesType?.toString() || null,
        unitOfMeasure: config?.unit || productConfig?.unit || 'LT',
        productName:
          config?.grade ||
          productConfig?.standardName ||
          row.Description ||
          'Sin Producto',
        pumpId: row.PumpId?.toString() || null,
        hoseId: row.HoseId?.toString() || null,
        tankId: row.TankId?.toString() || config?.tankId || null,
        isReconciled: false,
        reconcilerShiftId: row.ReconcilerShiftId?.toString() || null,
        fsAmount: row.fsAmount != null ? Number(row.fsAmount) : null,
        fsPPU: row.fsPPU != null ? Number(row.fsPPU) : null,
        fsVolume: row.fsVolume != null ? Number(row.fsVolume) : null,
        fsFinalVolume: row.fsFinalVolume != null ? Number(row.fsFinalVolume) : null,
        fsInitialVolume: row.fsInitialVolume != null ? Number(row.fsInitialVolume) : null,
        fsShiftId: row.fsShiftId?.toString() || null,
        appliedDocNo: row.AppliedDocNo?.toString() || null,
      };
    });

    const filterTransactionIds = [
      ...new Set(validRecords.map((r) => r.externalId).filter(Boolean)),
    ] as string[];
    const validTransactionIds = new Set<string>();

    for (let i = 0; i < filterTransactionIds.length; i += ETL.CHUNK_SIZE) {
      const chunk = filterTransactionIds.slice(i, i + 1000);
      const headers = await this.prisma.boSaleHeader.findMany({
        where: { source: 'TPV', storeCode, transactionId: { in: chunk } },
        select: { id: true, transactionId: true },
      });
      headers.forEach((h) => validTransactionIds.add(h.transactionId));
    }

    const filteredRecords = validRecords.filter((r) =>
      validTransactionIds.has(r.externalId),
    );

    const headersMap = new Map<string, string>();
    for (let i = 0; i < filterTransactionIds.length; i += ETL.CHUNK_SIZE) {
      const chunk = filterTransactionIds.slice(i, i + 1000);
      const headers = await this.prisma.boSaleHeader.findMany({
        where: { source: 'TPV', storeCode, transactionId: { in: chunk } },
        select: { id: true, transactionId: true },
      });
      headers.forEach((h) => headersMap.set(h.transactionId, h.id));
    }

    const recordsWithHeader = filteredRecords.map((r) => ({
      ...r,
      saleHeaderId: headersMap.get(r.externalId) || null,
    }));

    const reconcilerShiftIds: string[] = [
      ...new Set(
        recordsWithHeader.map((r) => r.reconcilerShiftId).filter(Boolean),
      ),
    ] as string[];

    if (reconcilerShiftIds.length > 0) {
      for (let i = 0; i < reconcilerShiftIds.length; i += ETL.CHUNK_SIZE) {
        const chunk = reconcilerShiftIds.slice(i, i + 1000);
        await this.prisma.boSale.deleteMany({
          where: { storeCode, reconcilerShiftId: { in: chunk } },
        });
      }
    }

    if (recordsWithHeader.length > 0) {
      for (let i = 0; i < recordsWithHeader.length; i += ETL.CHUNK_SIZE) {
        const chunk = recordsWithHeader.slice(i, i + 1000);
        await this.prisma.boSale.createMany({ data: chunk as any });
      }
    }
    this.logger.log(
      `Synced ${recordsWithHeader.length} sales lines for store ${storeCode}`,
    );
  }
}
