import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuditRepository,
  AuditEntry,
} from '../domain/ports/audit-repository.interface';

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  private readonly logger = new Logger(PrismaAuditRepository.name);

  constructor(private prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          storeCode: entry.storeCode,
          userId: entry.userId,
          metadata: entry.metadata,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Could not save activity log: ${error.message}`);
    }
  }

  async findAll(filters?: any): Promise<any[]> {
    try {
      const where: any = {};
      if (filters?.entity) where.entity = filters.entity;
      if (filters?.entityId) where.entityId = filters.entityId;
      if (filters?.storeCode) where.storeCode = filters.storeCode;
      if (filters?.userId) where.userId = filters.userId;
      if (filters?.action) where.action = filters.action;

      return await this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ? Number(filters.limit) : 100,
      });
    } catch (error: any) {
      this.logger.warn(`Could not query activity logs: ${error.message}`);
      return [];
    }
  }
}
