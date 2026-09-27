export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string;
  storeCode?: string;
  userId?: string;
  metadata?: string;
}

export interface AuditRepository {
  record(entry: AuditEntry): Promise<void>;
  findAll(filters?: any): Promise<any[]>;
}
