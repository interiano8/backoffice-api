import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IAuditUseCase } from '../../audit/domain/ports/in/audit.use-case.port';
import { AUDIT_USE_CASE } from '../../audit/audit.tokens';
import type { IConnectionFactory } from '../../common/connections/connection-factory.interface';
import type {
  CustomerRepository,
  CustomerData,
} from '../domain/ports/customer-repository.interface';

@Injectable()
export class CustomersTpvRepository implements CustomerRepository {
  private readonly logger = new Logger(CustomersTpvRepository.name);

  constructor(
    @Inject('IConnectionFactory')
    private readonly connectionFactory: IConnectionFactory,
    @Inject(AUDIT_USE_CASE)
    private auditUseCase: IAuditUseCase,
  ) {}

  async getCustomers(storeCode: string, options: any) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const params: Record<string, any> = {};
      const whereClauses: string[] = [];

      if (options.search) {
        params.search = `%${options.search}%`;
        whereClauses.push(
          '(codigo ILIKE @search OR nombre ILIKE @search OR rtn ILIKE @search)',
        );
      }
      if (options.billingType !== undefined && options.billingType !== '') {
        params.billingType = parseInt(options.billingType, 10);
        whereClauses.push('tipo_facturacion = @billingType');
      }

      const whereSql =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const countResult = await tpvPool.queryParams(
        `SELECT COUNT(*) as total FROM clientes ${whereSql}`,
        params,
      );
      const total = Number(countResult.recordset[0]?.total) || 0;

      const offset = (options.page - 1) * options.limit;
      params.limit = options.limit;
      params.offset = offset;

      const result = await tpvPool.queryParams(
        `
        SELECT 
          codigo as "customerNo", 
          nombre as "customerName", 
          rtn as "rtn",
          tipo_facturacion as "billingType", 
          bloqueado as "blocked"
        FROM clientes ${whereSql}
        ORDER BY nombre ASC LIMIT @limit OFFSET @offset
      `,
        params,
      );

      const customers: CustomerData[] = result.recordset.map((row: any) => ({
        customerNo: row.customerNo?.trim() || '',
        customerName: row.customerName?.trim() || '',
        rtn: row.rtn?.trim() || '',
        billingType: row.billingType,
        billingTypeLabel: row.billingType === 0 ? 'Credito' : 'Contado',
        blocked: row.blocked === true || row.blocked === 1,
      }));

      return {
        data: customers,
        total,
        page: options.page,
        limit: options.limit,
      };
    } catch (error: any) {
      this.logger.error(
        `Error fetching customers: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async getCustomer(storeCode: string, customerNo: string) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const result = await tpvPool.queryParams(
        `
          SELECT 
            codigo as "customerNo", 
            nombre as "customerName", 
            rtn as "rtn",
            tipo_facturacion as "billingType", 
            bloqueado as "blocked",
            direccion as "address", 
            telefono as "phone", 
            correo as "email"
          FROM clientes WHERE codigo = @customerNo
        `,
        { customerNo },
      );
      if (result.recordset.length === 0) return null;
      const row = result.recordset[0];
      return {
        customerNo: row.customerNo?.trim() || '',
        customerName: row.customerName?.trim() || '',
        rtn: row.rtn?.trim() || '',
        billingType: row.billingType,
        billingTypeLabel: row.billingType === 0 ? 'Credito' : 'Contado',
        blocked: row.blocked === true || row.blocked === 1,
        address: row.address?.trim() || '',
        phone: row.phone?.trim() || '',
        email: row.email?.trim() || '',
      };
    } catch (error: any) {
      this.logger.error(
        `Error fetching customer: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async updateCustomer(storeCode: string, customerNo: string, data: any) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const params: Record<string, any> = { customerNo };

      const customerResult = await tpvPool.queryParams(
        `SELECT tipo_facturacion, bloqueado FROM clientes WHERE codigo = @customerNo`,
        { customerNo },
      );
      if (customerResult.recordset.length === 0)
        throw new Error(`Customer ${customerNo} not found`);
      if (customerResult.recordset[0].tipo_facturacion === 0) {
        throw new Error(
          'Credit customers cannot be edited. Only enable/disable.',
        );
      }

      const updates: string[] = [];
      if (data.customerName !== undefined) {
        params.customerName = data.customerName;
        updates.push('nombre = @customerName');
      }
      if (data.rtn !== undefined) {
        params.rtn = data.rtn;
        updates.push('rtn = @rtn');
      }
      if (updates.length === 0)
        throw new Error('No fields provided for update');

      await tpvPool.queryParams(
        `UPDATE clientes SET ${updates.join(', ')} WHERE codigo = @customerNo`,
        params,
      );
      await this.auditUseCase.record({
        action: 'CUSTOMER_UPDATED',
        entity: 'Customer',
        entityId: customerNo,
        storeCode,
      });
      return { success: true, message: 'Customer updated successfully' };
    } catch (error: any) {
      this.logger.error(
        `Error updating customer: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async toggleCustomerStatus(storeCode: string, customerNo: string) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const params: Record<string, any> = { customerNo };

      const customerResult = await tpvPool.queryParams(
        `SELECT bloqueado FROM clientes WHERE codigo = @customerNo`,
        params,
      );
      if (customerResult.recordset.length === 0)
        throw new Error(`Customer ${customerNo} not found`);

      const currentBlocked = Boolean(customerResult.recordset[0].bloqueado);
      const newBlocked = !currentBlocked;
      params.blocked = newBlocked;
      await tpvPool.queryParams(
        `UPDATE clientes SET bloqueado = @blocked WHERE codigo = @customerNo`,
        params,
      );

      const action = newBlocked ? 'disabled' : 'enabled';
      await this.auditUseCase.record({
        action: 'CUSTOMER_TOGGLED',
        entity: 'Customer',
        entityId: customerNo,
        storeCode,
        metadata: JSON.stringify({ blocked: newBlocked }),
      });
      return {
        success: true,
        message: `Customer ${action} successfully`,
        blocked: newBlocked,
      };
    } catch (error: any) {
      this.logger.error(
        `Error toggling customer status: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  async createCustomer(
    storeCode: string,
    data: {
      customerNo: string;
      customerName: string;
      rtn?: string;
      billingType: number;
    },
  ) {
    let tpvPool: any | null = null;
    try {
      tpvPool = await this.getTpvConnection(storeCode);
      const existing = await tpvPool.queryParams(
        `SELECT codigo FROM clientes WHERE codigo = @customerNo`,
        { customerNo: data.customerNo },
      );
      if (existing.recordset.length > 0) {
        throw new Error(`El código de cliente ${data.customerNo} ya existe.`);
      }

      await tpvPool.queryParams(
        `
        INSERT INTO clientes (codigo, nombre, rtn, tipo_facturacion, bloqueado)
        VALUES (@customerNo, @customerName, @rtn, @billingType, false)
        `,
        {
          customerNo: data.customerNo,
          customerName: data.customerName,
          rtn: data.rtn || '',
          billingType: data.billingType ?? 1,
        },
      );

      await this.auditUseCase.record({
        action: 'CUSTOMER_CREATED',
        entity: 'Customer',
        entityId: data.customerNo,
        storeCode,
      });

      return {
        success: true,
        message: 'Cliente creado exitosamente',
        customerNo: data.customerNo,
      };
    } catch (error: any) {
      this.logger.error(
        `Error creating customer: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (tpvPool) await tpvPool.close();
    }
  }

  private getTpvConnection(storeCode: string) {
    return this.connectionFactory.getTpvConnection(storeCode);
  }
}
