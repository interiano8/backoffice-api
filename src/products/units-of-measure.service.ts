import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUnitOfMeasureDto,
  UpdateUnitOfMeasureDto,
} from './dto/unit-of-measure.dto';

@Injectable()
export class UnitsOfMeasureService {
  constructor(private readonly prisma: PrismaService) {}

  async listUnits(activeOnly = false) {
    const list = await this.prisma.boUnitOfMeasure.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { code: 'asc' },
    });

    // Sembrar valores por defecto si la tabla está vacía
    if (list.length === 0 && !activeOnly) {
      const defaults = [
        { code: 'UND', name: 'Unidad' },
        { code: 'GL', name: 'Galón' },
        { code: 'LT', name: 'Litro' },
        { code: 'CJA', name: 'Caja' },
        { code: 'PAQ', name: 'Paquete' },
      ];
      await this.prisma.boUnitOfMeasure.createMany({
        data: defaults,
        skipDuplicates: true,
      });
      return this.prisma.boUnitOfMeasure.findMany({
        orderBy: { code: 'asc' },
      });
    }

    return list;
  }

  async createUnit(dto: CreateUnitOfMeasureDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.boUnitOfMeasure.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException(`Ya existe una unidad de medida con el código ${code}`);
    }

    return this.prisma.boUnitOfMeasure.create({
      data: {
        code,
        name: dto.name.trim(),
        active: dto.active ?? true,
      },
    });
  }

  async updateUnit(id: string, dto: UpdateUnitOfMeasureDto) {
    const unit = await this.prisma.boUnitOfMeasure.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException('Unidad de medida no encontrada');
    }

    return this.prisma.boUnitOfMeasure.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        active: dto.active !== undefined ? dto.active : undefined,
      },
    });
  }

  async toggleUnit(id: string) {
    const unit = await this.prisma.boUnitOfMeasure.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException('Unidad de medida no encontrada');
    }

    return this.prisma.boUnitOfMeasure.update({
      where: { id },
      data: { active: !unit.active },
    });
  }
}
