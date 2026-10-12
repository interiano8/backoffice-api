import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/department-category.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Departamentos =====

  async listDepartments(activeOnly = false) {
    return this.prisma.boDepartment.findMany({
      where: activeOnly ? { active: true } : undefined,
      include: {
        categories: true,
        _count: { select: { products: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.boDepartment.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException(`Ya existe un departamento con el código ${code}`);
    }

    return this.prisma.boDepartment.create({
      data: {
        code,
        name: dto.name.trim(),
        active: dto.active ?? true,
      },
    });
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    const department = await this.prisma.boDepartment.findUnique({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Departamento no encontrado`);
    }

    return this.prisma.boDepartment.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        active: dto.active !== undefined ? dto.active : undefined,
      },
    });
  }

  async toggleDepartment(id: string) {
    const department = await this.prisma.boDepartment.findUnique({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Departamento no encontrado`);
    }
    return this.prisma.boDepartment.update({
      where: { id },
      data: { active: !department.active },
    });
  }

  // ===== Categorías =====

  async listCategories(departmentId?: string, activeOnly = false) {
    return this.prisma.boCategory.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
        ...(activeOnly ? { active: true } : {}),
      },
      include: {
        department: true,
        _count: { select: { products: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.boCategory.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException(`Ya existe una categoría con el código ${code}`);
    }

    if (dto.departmentId) {
      const dep = await this.prisma.boDepartment.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dep) {
        throw new BadRequestException(`El departamento indicado no existe`);
      }
    }

    return this.prisma.boCategory.create({
      data: {
        code,
        name: dto.name.trim(),
        departmentId: dto.departmentId || null,
        active: dto.active ?? true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.boCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Categoría no encontrada`);
    }

    return this.prisma.boCategory.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        departmentId: dto.departmentId !== undefined ? dto.departmentId : undefined,
        active: dto.active !== undefined ? dto.active : undefined,
      },
    });
  }

  async toggleCategory(id: string) {
    const category = await this.prisma.boCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Categoría no encontrada`);
    }
    return this.prisma.boCategory.update({
      where: { id },
      data: { active: !category.active },
    });
  }
}
