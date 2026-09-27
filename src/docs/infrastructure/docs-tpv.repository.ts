import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { IAuditUseCase } from '../../audit/domain/ports/in/audit.use-case.port';
import { AUDIT_USE_CASE } from '../../audit/audit.tokens';
import type { IConnectionFactory } from '../../common/connections/connection-factory.interface';
import { GALLON_TO_LITER_FACTOR } from '../../common/utils/volume-conversion';
import type { DocRepository } from '../domain/ports/doc-repository.interface';

@Injectable()
export class DocsTpvRepository implements DocRepository {
  private readonly logger = new Logger(DocsTpvRepository.name);

  constructor(
    private prisma: PrismaService,
    @Inject('IConnectionFactory')
    private readonly connectionFactory: IConnectionFactory,
    @Inject(AUDIT_USE_CASE)
    private auditUseCase: IAuditUseCase,
  ) {}

  async getRecentDocuments(storeCode: string, filters: any) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const params: Record<string, any> = {};
      const whereClauses: string[] = [];

      if (filters.startDate) {
        params.startDate = filters.startDate + ' 00:00:00';
        whereClauses.push('v.fecha_hora_venta >= @startDate');
      }
      if (filters.endDate) {
        params.endDate = filters.endDate + ' 23:59:59';
        whereClauses.push('v.fecha_hora_venta <= @endDate');
      }
      if (filters.shiftId) {
        params.shiftId = filters.shiftId;
        whereClauses.push('t.turno = @shiftId');
      }
      if (filters.docNo) {
        params.docNo = `%${filters.docNo}%`;
        whereClauses.push('v.numero_documento ILIKE @docNo');
      }
      if (filters.customerName) {
        params.customerName = `%${filters.customerName}%`;
        whereClauses.push('v.nombre_cliente ILIKE @customerName');
      }
      if (filters.docType && !isNaN(parseInt(filters.docType, 10))) {
        params.docType = parseInt(filters.docType, 10);
        whereClauses.push('v.tipo_documento = @docType');
      } else {
        whereClauses.push('v.tipo_documento IN (1, 2, 3, 7)');
      }
      if (filters.staff) {
        params.staff = `%${filters.staff}%`;
        whereClauses.push('v.codigo_vendedor ILIKE @staff');
      }
      if (filters.posTerminal) {
        params.posTerminal = `%${filters.posTerminal}%`;
        whereClauses.push('v.codigo_pos ILIKE @posTerminal');
      }

      const whereSql =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const countResult = await tpvPool.queryParams(
        `SELECT COUNT(*) as total FROM ventas v LEFT JOIN turnos t ON v.id_transaccion_pos = t.id_transaccion_pos ${whereSql}`,
        params,
      );
      const total = Number(countResult.recordset[0]?.total) || 0;

      const limit = !isNaN(parseInt(filters.limit, 10))
        ? parseInt(filters.limit, 10)
        : 100;
      const page = !isNaN(parseInt(filters.page, 10))
        ? parseInt(filters.page, 10)
        : 1;
      const offset = (page - 1) * limit;

      params.limit = limit;
      params.offset = offset;

      const headerResult = await tpvPool.queryParams(
        `
        SELECT 
          v.id_transaccion_pos as "transactionId", 
          COALESCE(v.numero_documento, '') as "docNo",
          COALESCE(v.tipo_documento, 1) as "docType", 
          TO_CHAR(v.fecha_hora_venta, 'YYYY-MM-DD HH24:MI:SS') as "date",
          COALESCE(v.monto, 0) as "totalAmount", 
          v.nombre_cliente as "customerName", 
          v.rtn_cliente as "rtn",
          v.codigo_cliente as "customerNo", 
          v.tipo_facturacion as "billingType", 
          v.placa as "placa",
          v.chofer as "chofer", 
          v.kilometraje as "km", 
          v.orden as "orden", 
          COALESCE(v.codigo_vendedor, '') as "staff",
          COALESCE(v.codigo_pos, '') as "posTerminal", 
          COALESCE(t.turno, '1') as "shiftNo",
          TO_CHAR(t.inicio_turno, 'YYYY-MM-DD') as "shiftDate", 
          t.pos_cierre as "status",
          vl.puntos as "lealPoints", 
          vl.puntos_activos as "lealActivePoints",
          vl.tipo as "lealType", 
          vl.dni as "lealDNI", 
          vl.nombre as "lealName", 
          vl.id_aleatorio as "lealId"
        FROM ventas v
        LEFT JOIN turnos t ON v.id_transaccion_pos = t.id_transaccion_pos
        LEFT JOIN ventas_leal vl ON v.id_transaccion_pos = vl.id_transaccion_pos
        ${whereSql}
        ORDER BY v.fecha_hora_venta DESC
        LIMIT @limit OFFSET @offset
      `,
        params,
      );

      const headers = headerResult.recordset;
      if (headers.length === 0) return { data: [], total: 0 };

      const docNos = headers.map((d: any) => d.docNo);
      const transactionIds = headers.map((d: any) => d.transactionId);

      const lineResults = await this.batchQueryLines(tpvPool, docNos);
      const payResults = await this.batchQueryPayments(tpvPool, transactionIds);

      const linesByDocNo = this.groupByKey(lineResults, 'docNo');
      const paymentsByTxnId = this.groupByKey(payResults, 'transactionId');

      const enrichedDocs = headers.map((doc: any) => ({
        ...doc,
        leal: doc.lealDNI ? {
          points: Number(doc.lealPoints || 0),
          activePoints: Number(doc.lealActivePoints || 0),
          type: Number(doc.lealType || 0),
          dni: doc.lealDNI,
          name: doc.lealName,
          id: doc.lealId,
        } : null,
        lines: (linesByDocNo.get(doc.docNo) || []).map((l: any) => ({
          description: l.description,
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          discount: Number(l.discount) || 0,
          discountPct: Number(l.discountPct) || 0,
          amount: Number(l.amount) || 0,
          pumpId: l.pumpId,
          hoseId: l.hoseId,
          volumeLT: Number(l.quantity || 0),
          volumeGL: Number(l.quantity || 0) / GALLON_TO_LITER_FACTOR,
        })),
        payments: (paymentsByTxnId.get(doc.transactionId) || []).map(
          (p: any) => ({
            paymentMethod: p.paymentMethod,
            description: p.description,
            amount: Number(p.amount) || 0,
          }),
        ),
      }));

      return { data: enrichedDocs, total };
    } catch (error: any) {
      this.logger.error(`Error fetching docs: ${error.message}`, error.stack);
      throw error;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async getLealDocuments(storeCode: string, filters: any) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const params: Record<string, any> = {};
      const whereClauses: string[] = [];

      if (filters.startShiftDate) {
        params.startShiftDate = filters.startShiftDate + ' 00:00:00';
        whereClauses.push('t.inicio_turno >= @startShiftDate');
      }
      if (filters.endShiftDate) {
        params.endShiftDate = filters.endShiftDate + ' 23:59:59';
        whereClauses.push('t.inicio_turno <= @endShiftDate');
      }
      if (filters.lealType !== undefined && filters.lealType !== null && filters.lealType !== '') {
        params.lealType = parseInt(filters.lealType, 10);
        whereClauses.push('vl.tipo = @lealType');
      }

      const whereSql =
        whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';

      const countResult = await tpvPool.queryParams(
        `SELECT COUNT(*) as total
         FROM ventas v
         LEFT JOIN turnos t ON v.id_transaccion_pos = t.id_transaccion_pos
         INNER JOIN ventas_leal vl ON v.id_transaccion_pos = vl.id_transaccion_pos
         WHERE 1=1 ${whereSql}`,
        params,
      );
      const total = Number(countResult.recordset[0]?.total) || 0;

      const limit = !isNaN(parseInt(filters.limit, 10))
        ? parseInt(filters.limit, 10)
        : 50;
      const page = !isNaN(parseInt(filters.page, 10))
        ? parseInt(filters.page, 10)
        : 1;
      const offset = (page - 1) * limit;

      params.limit = limit;
      params.offset = offset;

      const headerResult = await tpvPool.queryParams(
        `
        SELECT 
          v.id_transaccion_pos as "transactionId", 
          COALESCE(v.numero_documento, '') as "docNo",
          COALESCE(v.tipo_documento, 1) as "docType", 
          TO_CHAR(v.fecha_hora_venta, 'YYYY-MM-DD HH24:MI:SS') as "date",
          COALESCE(v.monto, 0) as "totalAmount", 
          v.nombre_cliente as "customerName", 
          v.rtn_cliente as "rtn",
          v.codigo_cliente as "customerNo", 
          v.tipo_facturacion as "billingType", 
          v.placa as "placa",
          v.chofer as "chofer", 
          v.kilometraje as "km", 
          v.orden as "orden", 
          COALESCE(v.codigo_vendedor, '') as "staff",
          COALESCE(v.codigo_pos, '') as "posTerminal", 
          COALESCE(t.turno, '1') as "shiftNo",
          TO_CHAR(t.inicio_turno, 'YYYY-MM-DD') as "shiftDate", 
          t.pos_cierre as "status",
          vl.puntos as "lealPoints", 
          vl.puntos_activos as "lealActivePoints",
          vl.tipo as "lealType", 
          vl.dni as "lealDNI", 
          vl.nombre as "lealName", 
          vl.id_aleatorio as "lealId"
        FROM ventas v
        LEFT JOIN turnos t ON v.id_transaccion_pos = t.id_transaccion_pos
        INNER JOIN ventas_leal vl ON v.id_transaccion_pos = vl.id_transaccion_pos
        WHERE 1=1 ${whereSql}
        ORDER BY v.fecha_hora_venta DESC
        LIMIT @limit OFFSET @offset
      `,
        params,
      );

      const headers = headerResult.recordset;
      if (headers.length === 0) return { data: [], total: 0 };

      const docNos = headers.map((d: any) => d.docNo);
      const transactionIds = headers.map((d: any) => d.transactionId);

      const lineResults = await this.batchQueryLines(tpvPool, docNos);
      const payResults = await this.batchQueryPayments(tpvPool, transactionIds);

      const linesByDocNo = this.groupByKey(lineResults, 'docNo');
      const paymentsByTxnId = this.groupByKey(payResults, 'transactionId');

      const enrichedDocs = headers.map((doc: any) => ({
        ...doc,
        leal: {
          points: Number(doc.lealPoints || 0),
          activePoints: Number(doc.lealActivePoints || 0),
          type: Number(doc.lealType || 0),
          dni: doc.lealDNI,
          name: doc.lealName,
          id: doc.lealId,
        },
        lines: (linesByDocNo.get(doc.docNo) || []).map((l: any) => ({
          description: l.description,
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          discount: Number(l.discount) || 0,
          discountPct: Number(l.discountPct) || 0,
          amount: Number(l.amount) || 0,
          pumpId: l.pumpId,
          hoseId: l.hoseId,
          volumeLT: Number(l.quantity || 0),
          volumeGL: Number(l.quantity || 0) / GALLON_TO_LITER_FACTOR,
        })),
        payments: (paymentsByTxnId.get(doc.transactionId) || []).map(
          (p: any) => ({
            paymentMethod: p.paymentMethod,
            description: p.description,
            amount: Number(p.amount) || 0,
          }),
        ),
      }));

      return { data: enrichedDocs, total };
    } catch (error: any) {
      this.logger.error(`Error fetching Leal docs: ${error.message}`, error.stack);
      throw error;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async getCustomers(storeCode: string, search: string) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const sql = `SELECT codigo as "customerNo", nombre as "customerName",
        rtn as "rtn", tipo_facturacion as "usualBillingType", bloqueado as "blocked"
        FROM clientes`;
      if (search) {
        const result = await tpvPool.queryParams(
          sql +
            ' WHERE codigo ILIKE @search OR nombre ILIKE @search OR rtn ILIKE @search ORDER BY nombre ASC LIMIT 50',
          { search: `%${search}%` },
        );
        return result.recordset;
      }
      return (await tpvPool.query(sql + ' ORDER BY nombre ASC LIMIT 50')).recordset;
    } catch (error: any) {
      this.logger.error(`Error fetching customers: ${error.message}`);
      return [];
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async getChargeMethods(storeCode: string) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      return (
        await tpvPool.query(`
        SELECT codigo as "code", descripcion as "description"
        FROM metodos_pago WHERE activo = true ORDER BY descripcion ASC
      `)
      ).recordset;
    } catch (error: any) {
      this.logger.error(`Error fetching charge methods: ${error.message}`);
      return [];
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async getPosCodes(storeCode: string) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const result = await tpvPool.query(
        `SELECT DISTINCT codigo_pos as "POS Code" FROM configuracion_pos ORDER BY codigo_pos`,
      );
      return result.recordset.map((r: any) => r['POS Code']).filter(Boolean);
    } catch (error: any) {
      this.logger.error(`Error fetching POS codes: ${error.message}`);
      return [];
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async getUsers(storeCode: string) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const result = await tpvPool.query(
        `SELECT usuario as "Usuario" FROM empleados WHERE esta_activo = true ORDER BY usuario`,
      );
      return result.recordset.map((r: any) => r['Usuario']).filter(Boolean);
    } catch (error: any) {
      this.logger.error(`Error fetching users: ${error.message}`);
      return [];
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async getShiftCount(storeCode: string) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const result = await tpvPool.query(
        `SELECT turnos FROM tiendas LIMIT 1`,
      );
      return result.recordset[0]?.turnos || 0;
    } catch (error: any) {
      this.logger.error(`Error fetching shift count: ${error.message}`);
      return 0;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async updateDocument(storeCode: string, transactionId: string, data: any) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);

      const logResult = await tpvPool.queryParams(
        `
        SELECT id_tienda as "GasStationCode", codigo_pos as "POSCode"
        FROM ventas WHERE id_transaccion_pos = @transactionId
      `,
        { transactionId },
      );
      const log = logResult.recordset[0];

      if (!log) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      if (data.docType === 2) await this.validateCreditCustomer(tpvPool, data);
      if (
        data.docType === 1 &&
        data.payments?.some((p: any) => p.paymentMethod === 'CREDITO')
      ) {
        throw new Error(
          "Cash invoices cannot have 'CREDITO' as payment method.",
        );
      }

      const billingType = data.docType === 1 ? 1 : 0;
      const updateParams: Record<string, any> = {
        transactionId,
        docType: data.docType,
        customerNo: data.customerNo || '',
        customerName: data.customerName || '',
        rtn: data.rtn || '',
        billingType,
        placa: data.placa || '',
        chofer: data.chofer || '',
        km: data.km || '',
        orden: data.orden || '',
      };

      await tpvPool.queryParams(
        `
        UPDATE ventas SET tipo_documento = @docType, codigo_cliente = @customerNo,
          nombre_cliente = @customerName, rtn_cliente = @rtn, tipo_facturacion = @billingType,
          placa = @placa, chofer = @chofer, kilometraje = @km, orden = @orden
        WHERE id_transaccion_pos = @transactionId
      `,
        updateParams,
      );
      await tpvPool.queryParams(
        `
        UPDATE lineas_venta SET tipo_documento = @docType
        WHERE id_transaccion_pos = @transactionId
      `,
        { transactionId, docType: data.docType },
      );
      await tpvPool.queryParams(
        `
        DELETE FROM pagos_venta WHERE id_transaccion_pos = @transactionId
      `,
        { transactionId },
      );

      if (data.payments?.length > 0) {
        for (const [index, pay] of data.payments.entries()) {
          const payParams: Record<string, any> = {
            transactionId,
            lineNo: (index + 1) * 10,
            method: pay.paymentMethod,
            desc: pay.description || pay.paymentMethod,
            amount: pay.amount,
            gasStation: log.GasStationCode || '',
            posCode: log.POSCode || '',
          };
          await tpvPool.queryParams(
            `
            INSERT INTO pagos_venta
            (id_transaccion_pos, numero_linea_pago, codigo_metodo_pago, descripcion, monto,
             id_tienda, codigo_pos, monto_ingresado, tasa_cambio, es_ticket)
            VALUES (@transactionId, @lineNo, @method, @desc, @amount,
             @gasStation, @posCode, @amount, 1.0, false)
          `,
            payParams,
          );
        }
      }

      await this.auditUseCase.record({
        action: 'DOCUMENT_UPDATED',
        entity: 'Document',
        entityId: transactionId,
        storeCode,
      });
      return { success: true, message: 'Document updated successfully' };
    } catch (error: any) {
      this.logger.error(`Error updating doc: ${error.message}`, error.stack);
      throw error;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  private async batchQueryLines(pool: any, docNos: string[]) {
    if (docNos.length === 0) return [];
    const params: Record<string, any> = {};
    docNos.forEach((no, i) => {
      params[`docNo${i}`] = no;
    });
    const placeholders = docNos.map((_, i) => `@docNo${i}`).join(',');
    return (
      await pool.queryParams(
        `
      SELECT 
        lv.numero_documento as "docNo", 
        lv.descripcion as "description", 
        lv.cantidad as "quantity",
        lv.precio_unitario_con_isv as "unitPrice", 
        COALESCE(lv.monto_descuento_linea, lv.descuento, 0) as "discount",
        COALESCE(lv.descuento, 0) as "discountPct", 
        lv.monto_con_isv as "amount",
        lv.numero_bomba as "pumpId", 
        lv.posicion_bomba as "hoseId"
      FROM lineas_venta lv
      WHERE lv.numero_documento IN (${placeholders})
    `,
        params,
      )
    ).recordset;
  }

  private async batchQueryPayments(pool: any, transactionIds: string[]) {
    if (transactionIds.length === 0) return [];
    const params: Record<string, any> = {};
    transactionIds.forEach((id, i) => {
      params[`tid${i}`] = id;
    });
    const placeholders = transactionIds.map((_, i) => `@tid${i}`).join(',');
    return (
      await pool.queryParams(
        `
      SELECT 
        TRIM(pv.id_transaccion_pos) as "transactionId", 
        TRIM(pv.codigo_metodo_pago) as "paymentMethod",
        TRIM(pv.descripcion) as "description", 
        pv.monto as "amount"
      FROM pagos_venta pv
      WHERE TRIM(pv.id_transaccion_pos) IN (${placeholders})
    `,
        params,
      )
    ).recordset;
  }

  private async validateCreditCustomer(pool: any, data: any) {
    if (
      !data.customerNo ||
      data.customerNo === '0000' ||
      data.customerNo.toUpperCase() === 'CONTADO'
    ) {
      throw new Error('Selected customer does not allow credit sales.');
    }
    const result = await pool.queryParams(
      'SELECT tipo_facturacion as "Usual Billing Type", bloqueado as "Blocked" FROM clientes WHERE codigo = @custNo',
      { custNo: data.customerNo },
    );
    const customer = result.recordset[0];
    if (!customer)
      throw new Error(`Customer ${data.customerNo} does not exist.`);
    if (customer['Blocked'] === true || customer['Blocked'] === 1)
      throw new Error(`Customer ${data.customerNo} is BLOCKED.`);
    if (
      customer['Usual Billing Type'] !== 0 &&
      customer['Usual Billing Type'] !== undefined &&
      customer['Usual Billing Type'] !== null
    ) {
      throw new Error(`Customer ${data.customerNo} is CASH only.`);
    }
  }

  private groupByKey(records: any[], key: string) {
    const map = new Map<string, any[]>();
    for (const record of records) {
      const k = record[key];
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(record);
    }
    return map;
  }

  private getTpvConnection(storeCode: string) {
    return this.connectionFactory.getTpvConnection(storeCode);
  }
}
