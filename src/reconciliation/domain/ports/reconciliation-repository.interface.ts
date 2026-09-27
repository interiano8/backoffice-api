export interface ReconciliationEntity {
  id: string;
  type: string;
  shiftNo?: string;
  shiftDate?: Date;
  attendantName?: string;
  pumpId?: string;
  status: string;
  difference?: number;
  signedBy?: string;
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconciliationRepository {
  create(data: any): Promise<ReconciliationEntity>;
  findAll(storeCode?: string): Promise<ReconciliationEntity[]>;
  findOne(id: string): Promise<ReconciliationEntity | null>;
}
