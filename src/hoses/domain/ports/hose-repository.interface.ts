export interface HoseEntity {
  id: string;
  storeCode: string;
  pumpId: number;
  hoseId: number;
  gradeId?: number;
  gradeName: string;
  unitPrice?: number;
  tankId?: string | null;
  hosePhysicalId?: number | null;
  posCode?: string | null;
  genericCode?: string | null;
  unitOfMeasure?: string | null;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateHoseData {
  storeCode: string;
  pumpId: number;
  hoseId: number;
  gradeName: string;
  gradeId?: number;
  unitPrice?: number;
  tankId?: string | null;
  active?: boolean;
  unitOfMeasure?: string;
  posCode?: string | null;
  genericCode?: string | null;
}

export interface HoseRepository {
  findByStore(storeCode: string): Promise<HoseEntity[]>;
  updatePrice(id: string, unitPrice: number): Promise<HoseEntity>;
  create(data: CreateHoseData): Promise<HoseEntity>;
  update(id: string, data: Partial<CreateHoseData>): Promise<HoseEntity>;
  delete(id: string): Promise<void>;
}
