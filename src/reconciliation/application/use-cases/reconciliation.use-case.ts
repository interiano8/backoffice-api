import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IReconciliationUseCase } from '../../domain/ports/in/reconciliation.use-case.port';
import type { ReconciliationRepository, ReconciliationEntity } from '../../domain/ports/reconciliation-repository.interface';
import { RECONCILIATION_REPOSITORY } from '../../reconciliation.tokens';
import { EntityNotFoundException, ValidationException } from '../../../common/domain/exceptions/domain.exception';

@Injectable()
export class ReconciliationUseCase implements IReconciliationUseCase {
  private readonly logger = new Logger(ReconciliationUseCase.name);

  constructor(
    @Inject(RECONCILIATION_REPOSITORY)
    private readonly reconciliationRepo: ReconciliationRepository,
  ) {}

  async createReconciliation(data: any): Promise<ReconciliationEntity> {
    if (!data) {
      throw new ValidationException('Reconciliation data is required.');
    }
    return this.reconciliationRepo.create(data);
  }

  async getAll(storeCode?: string): Promise<ReconciliationEntity[]> {
    return this.reconciliationRepo.findAll(storeCode);
  }

  async getById(id: string): Promise<ReconciliationEntity | null> {
    const item = await this.reconciliationRepo.findOne(id);
    if (!item) {
      throw new EntityNotFoundException('Reconciliation', id);
    }
    return item;
  }
}
