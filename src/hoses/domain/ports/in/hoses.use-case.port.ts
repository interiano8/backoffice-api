import type { HoseEntity, CreateHoseData } from '../hose-repository.interface';

export interface IHosesUseCase {
  findByStore(storeCode: string): Promise<HoseEntity[]>;
  updatePrice(id: string, unitPrice: number): Promise<HoseEntity>;
  create(data: CreateHoseData): Promise<HoseEntity>;
  update(id: string, data: Partial<CreateHoseData>): Promise<HoseEntity>;
  delete(id: string): Promise<void>;
}
