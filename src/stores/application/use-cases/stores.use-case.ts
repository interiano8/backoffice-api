import { Injectable, Logger, Inject, ConflictException } from '@nestjs/common';
import { IStoresUseCase } from '../../domain/ports/in/stores.use-case.port';
import type { StoresRepository } from '../../domain/ports/stores-repository.interface';
import { STORES_REPOSITORY } from '../../stores.tokens';
import type { IAuditUseCase } from '../../../audit/domain/ports/in/audit.use-case.port';
import { AUDIT_USE_CASE } from '../../../audit/audit.tokens';

@Injectable()
export class StoresUseCase implements IStoresUseCase {
  private readonly logger = new Logger(StoresUseCase.name);

  constructor(
    @Inject(STORES_REPOSITORY)
    private readonly storesRepo: StoresRepository,
    @Inject(AUDIT_USE_CASE)
    private readonly auditUseCase: IAuditUseCase,
  ) {}

  findAll() {
    return this.storesRepo.findAll();
  }

  async findAllBasic() {
    try {
      const stores = await this.storesRepo.findAllBasic();
      this.logger.log(`findAllBasic found ${stores.length} stores`);
      return stores;
    } catch (error: any) {
      this.logger.error(`Error in findAllBasic: ${error.message}`, error.stack);
      throw error;
    }
  }

  async create(data: any, userId?: string) {
    // La casa matriz (000) no puede crearse como estación operativa; se siembra aparte.
    if (data.code && String(data.code).trim().toUpperCase() === '000') {
      throw new ConflictException('El código 000 está reservado para la casa matriz.');
    }

    if (data.code && this.storesRepo.findByCode) {
      const existing = await this.storesRepo.findByCode(data.code);
      if (existing) {
        throw new ConflictException(`El código de tienda '${data.code}' ya se encuentra registrado.`);
      }
    }

    // Herencia de la casa matriz: los campos comunes se prellenan con los valores
    // de la tienda 000 cuando el payload no los especifica (se copian, luego editables).
    const withHqDefaults = await this.applyHqDefaults(data);

    const store = await this.storesRepo.create(withHqDefaults);

    await this.auditUseCase
      .record({
        action: 'STORE_CREATED',
        entity: 'BoStore',
        entityId: store.code || store.id,
        storeCode: store.code,
        userId: userId || 'system',
        metadata: JSON.stringify({ name: store.name, code: store.code, ip: store.ip }),
      })
      .catch((err) => this.logger.warn(`Audit error on STORE_CREATED: ${err.message}`));

    return store;
  }

  /** Campos de la empresa que se heredan de la casa matriz (tienda 000). */
  private readonly HQ_INHERITED_FIELDS: (keyof import('../../domain/ports/stores-repository.interface').StoreEntity)[] = [
    'titulo', 'RTN', 'address', 'logoUrl', 'moduleCustomers', 'moduleAccounting', 'printCreditInvoices',
    'SyncMinutes', 'PresentationMinutes', 'emisor', 'moneda', 'codigoMoneda',
    'telefono', 'correo', 'validarSaldoCredito',
  ];

  /** Si existe la casa matriz (000), rellena los campos comunes que vengan vacíos. */
  private async applyHqDefaults(data: any): Promise<any> {
    const out = { ...(data ?? {}) };
    try {
      const hq = await this.storesRepo.findByCode('000');
      if (!hq) return out;
      for (const field of this.HQ_INHERITED_FIELDS) {
        const value = out[field];
        const hqValue = (hq as any)?.[field];
        // solo copiar si el payload no trae valor y la casa matriz sí tiene
        if ((value === undefined || value === null || value === '') && hqValue !== undefined && hqValue !== null) {
          (out as any)[field] = hqValue;
        }
      }
    } catch (err) {
      this.logger.warn(`applyHqDefaults fallo: ${(err as Error).message}`);
    }
    return out;
  }

  findOne(id: string) {
    return this.storesRepo.findOne(id);
  }

  async update(id: string, data: any, userId?: string) {
    if (data.code && this.storesRepo.findByCode) {
      const existing = await this.storesRepo.findByCode(data.code);
      if (existing && existing.id !== id) {
        throw new ConflictException(`El código de tienda '${data.code}' ya está en uso.`);
      }
    }

    const store = await this.storesRepo.update(id, data);

    await this.auditUseCase
      .record({
        action: 'STORE_UPDATED',
        entity: 'BoStore',
        entityId: store.code || store.id,
        storeCode: store.code,
        userId: userId || 'system',
        metadata: JSON.stringify({ name: store.name, code: store.code }),
      })
      .catch((err) => this.logger.warn(`Audit error on STORE_UPDATED: ${err.message}`));

    return store;
  }

  async remove(id: string, userId?: string) {
    const store = await this.storesRepo.findOne(id);
    await this.storesRepo.remove(id);

    await this.auditUseCase
      .record({
        action: 'STORE_DELETED',
        entity: 'BoStore',
        entityId: store?.code || id,
        storeCode: store?.code,
        userId: userId || 'system',
        metadata: JSON.stringify({ name: store?.name, code: store?.code }),
      })
      .catch((err) => this.logger.warn(`Audit error on STORE_DELETED: ${err.message}`));
  }

  async testConnection(config: any, userId?: string) {
    const result = await this.storesRepo.testConnection(config);

    await this.auditUseCase
      .record({
        action: 'STORE_CONNECTION_TEST',
        entity: 'BoStore',
        entityId: config.ip || 'unknown',
        userId: userId || 'system',
        metadata: JSON.stringify({
          ip: config.ip,
          dbPort: config.dbPort,
          success: result.success,
          message: result.message || result.error,
        }),
      })
      .catch((err) => this.logger.warn(`Audit error on STORE_CONNECTION_TEST: ${err.message}`));

    return result;
  }
}
