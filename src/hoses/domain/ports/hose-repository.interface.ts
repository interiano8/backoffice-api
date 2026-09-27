export interface HoseEntity {
  id: string;
  storeCode: string;
  pumpId: number;
  hoseId: number;
  gradeName: string;
  unitPrice?: number;
  active: boolean;
}

export interface HoseRepository {
  findByStore(storeCode: string): Promise<HoseEntity[]>;
  updatePrice(id: string, unitPrice: number): Promise<HoseEntity>;
}
