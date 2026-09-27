import { AuditEntry } from '../audit-repository.interface';

export interface IAuditUseCase {
  record(entry: AuditEntry): Promise<void>;
  findAll(filters?: any): Promise<any[]>;
}
