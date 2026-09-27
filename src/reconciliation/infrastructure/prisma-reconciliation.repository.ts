import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ReconciliationRepository,
  ReconciliationEntity,
} from '../domain/ports/reconciliation-repository.interface';

@Injectable()
export class PrismaReconciliationRepository
  implements ReconciliationRepository
{
  constructor(private prisma: PrismaService) {}

  async create(data: any): Promise<ReconciliationEntity> {
    return this.prisma.boReconciliation.create({ data }) as any;
  }

  async findAll(storeCode?: string): Promise<ReconciliationEntity[]> {
    const where: any = {};
    if (storeCode) {
      where.storeCode = storeCode;
    }
    return this.prisma.boReconciliation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    }) as any;
  }

  async findOne(id: string): Promise<ReconciliationEntity | null> {
    return this.prisma.boReconciliation.findUnique({ where: { id } }) as any;
  }
}
