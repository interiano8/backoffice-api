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
    if (data.code && this.storesRepo.findByCode) {
      const existing = await this.storesRepo.findByCode(data.code);
      if (existing) {
        throw new ConflictException(`El código de tienda '${data.code}' ya se encuentra registrado.`);
      }
    }

    const store = await this.storesRepo.create(data);

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
