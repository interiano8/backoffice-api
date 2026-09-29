import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HoseRepository,
  HoseEntity,
  CreateHoseData,
} from '../domain/ports/hose-repository.interface';

@Injectable()
export class PrismaHoseRepository implements HoseRepository {
  constructor(private prisma: PrismaService) {}

  private inferGradeId(gradeName: string): number {
    const norm = (gradeName || '').toUpperCase();
    if (norm.includes('SUPER')) return 1;
    if (norm.includes('REGULAR')) return 2;
    if (norm.includes('DIESEL')) return 3;
    if (norm.includes('KEROSENE') || norm.includes('QUEROSENO')) return 4;
    if (norm.includes('GLP') || norm.includes('GAS')) return 5;
    return 1;
  }

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

  private inferGenericCode(gradeName: string, explicitCode?: string | null): string {
    if (explicitCode && explicitCode.trim()) return explicitCode.trim().toUpperCase();
    const norm = (gradeName || '').toUpperCase();
    if (norm.includes('SUPER')) return 'SUPER';
    if (norm.includes('REGULAR')) return 'REGULAR';
    if (norm.includes('DIESEL')) return 'DIESEL';
    if (norm.includes('KEROSENE') || norm.includes('QUEROSENO')) return 'KEROSENE';
    if (norm.includes('GLP') || norm.includes('GAS')) return 'GLP';
    return norm.slice(0, 10) || 'COMBUSTIBLE';
  }

  async create(data: CreateHoseData): Promise<HoseEntity> {
    const gradeId = data.gradeId ?? this.inferGradeId(data.gradeName);
    const genericCode = this.inferGenericCode(data.gradeName, data.genericCode || data.posCode);
    const posCode = data.posCode ? data.posCode.trim().toUpperCase() : genericCode;

    return this.prisma.boHose.upsert({
      where: {
        storeCode_pumpId_hoseId: {
          storeCode: data.storeCode,
          pumpId: Number(data.pumpId),
          hoseId: Number(data.hoseId),
        },
      },
      create: {
        storeCode: data.storeCode,
        pumpId: Number(data.pumpId),
        hoseId: Number(data.hoseId),
        gradeId,
        gradeName: data.gradeName.trim(),
        unitPrice: data.unitPrice !== undefined ? data.unitPrice : null,
        tankId: data.tankId || null,
        active: data.active ?? true,
        unitOfMeasure: data.unitOfMeasure || 'GAL',
        posCode,
        genericCode,
      },
      update: {
        gradeId,
        gradeName: data.gradeName.trim(),
        unitPrice: data.unitPrice !== undefined ? data.unitPrice : undefined,
        tankId: data.tankId !== undefined ? data.tankId : undefined,
        active: data.active !== undefined ? data.active : true,
        posCode,
        genericCode,
      },
    }) as any;
  }

  async update(id: string, data: Partial<CreateHoseData>): Promise<HoseEntity> {
    const updateData: any = { ...data };
    if (updateData.gradeName && !updateData.gradeId) {
      updateData.gradeId = this.inferGradeId(updateData.gradeName);
      updateData.gradeName = updateData.gradeName.trim();
    }
    if (updateData.genericCode !== undefined || updateData.posCode !== undefined || updateData.gradeName) {
      const code = this.inferGenericCode(
        updateData.gradeName || '',
        updateData.genericCode || updateData.posCode,
      );
      if (updateData.genericCode !== undefined) updateData.genericCode = updateData.genericCode ? updateData.genericCode.trim().toUpperCase() : code;
      if (updateData.posCode !== undefined) updateData.posCode = updateData.posCode ? updateData.posCode.trim().toUpperCase() : code;
    }
    if (updateData.pumpId !== undefined) updateData.pumpId = Number(updateData.pumpId);
    if (updateData.hoseId !== undefined) updateData.hoseId = Number(updateData.hoseId);

    return this.prisma.boHose.update({
      where: { id },
      data: updateData,
    }) as any;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.boHose.delete({
      where: { id },
    });
  }
}
