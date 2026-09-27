import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HoseRepository,
  HoseEntity,
} from '../domain/ports/hose-repository.interface';

@Injectable()
export class PrismaHoseRepository implements HoseRepository {
  constructor(private prisma: PrismaService) {}

  async findByStore(storeCode: string): Promise<HoseEntity[]> {
    return this.prisma.boHose.findMany({
      where: { storeCode, active: true },
      orderBy: [{ pumpId: 'asc' }, { hoseId: 'asc' }],
    }) as any;
  }

  async updatePrice(id: string, unitPrice: number): Promise<HoseEntity> {
    return this.prisma.boHose.update({
      where: { id },
      data: { unitPrice },
    }) as any;
  }
}
