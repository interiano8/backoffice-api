import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';

@Injectable()
export class CostCentersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCostCenters(activeOnly = false) {
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }
    return this.prisma.costCenter.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async getCostCenterById(id: string) {
    const cc = await this.prisma.costCenter.findUnique({ where: { id } });
    if (!cc) {
      throw new NotFoundException(`Centro de costo con ID ${id} no encontrado`);
    }
    return cc;
  }

  async getCostCenterByCode(code: string) {
    return this.prisma.costCenter.findUnique({ where: { code } });
  }

  async createCostCenter(dto: CreateCostCenterDto) {
    const existing = await this.prisma.costCenter.findUnique({
      where: { code: dto.code.trim() },
    });

    if (existing) {
      throw new BadRequestException(`Ya existe un centro de costo con el código ${dto.code}`);
    }

    return this.prisma.costCenter.create({
      data: {
        code: dto.code.trim(),
        name: dto.name.trim(),
        storeCode: dto.storeCode?.trim() || null,
        isActive: true,
      },
    });
  }

  async updateCostCenter(id: string, dto: UpdateCostCenterDto) {
    await this.getCostCenterById(id);

    return this.prisma.costCenter.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.storeCode !== undefined && { storeCode: dto.storeCode.trim() || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteCostCenter(id: string) {
    const cc = await this.getCostCenterById(id);

    const linesCount = await this.prisma.journalEntryLine.count({
      where: { costCenterId: id },
    });

    if (linesCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el centro de costo ${cc.code} porque tiene ${linesCount} movimientos contables asociados. Desactívelo en su lugar.`,
      );
    }

    return this.prisma.costCenter.delete({
      where: { id },
    });
  }
}
