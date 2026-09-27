import { Injectable, Logger, Inject } from '@nestjs/common';
import { IAuditUseCase } from '../../domain/ports/in/audit.use-case.port';
import type {
  AuditRepository,
  AuditEntry,
} from '../../domain/ports/audit-repository.interface';
import { AUDIT_REPOSITORY } from '../../audit.tokens';

@Injectable()
export class AuditUseCase implements IAuditUseCase {
  private readonly logger = new Logger(AuditUseCase.name);

  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepo: AuditRepository,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditRepo.record(entry);
      this.logger.log(
        `Audit recorded: ${entry.action} on ${entry.entity} ${entry.entityId || ''}`,
      );
    } catch (error: any) {
      this.logger.error(`Error recording audit: ${error.message}`, error.stack);
    }
  }

  async findAll(filters?: any) {
    try {
      return await this.auditRepo.findAll(filters);
    } catch (error: any) {
      this.logger.error(`Error listing audits: ${error.message}`, error.stack);
      throw error;
    }
  }
}
