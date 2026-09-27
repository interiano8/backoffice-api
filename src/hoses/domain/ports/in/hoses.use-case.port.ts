import type { HoseEntity } from '../hose-repository.interface';

export interface IHosesUseCase {
  findByStore(storeCode: string): Promise<HoseEntity[]>;
  updatePrice(id: string, unitPrice: number): Promise<HoseEntity>;
}
