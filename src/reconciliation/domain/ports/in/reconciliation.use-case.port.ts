import type { ReconciliationEntity } from '../reconciliation-repository.interface';

export interface IReconciliationUseCase {
  createReconciliation(data: any): Promise<ReconciliationEntity>;
  getAll(storeCode?: string): Promise<ReconciliationEntity[]>;
  getById(id: string): Promise<ReconciliationEntity | null>;
}
