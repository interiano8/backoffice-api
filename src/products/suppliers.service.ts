import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async listSuppliers(activeOnly = false) {
    return this.prisma.boSupplier.findMany({
      where: activeOnly ? { active: true } : undefined,
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getSupplierById(id: string) {
    const supplier = await this.prisma.boSupplier.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    return supplier;
  }

  async createSupplier(dto: CreateSupplierDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.boSupplier.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException(`Ya existe un proveedor con el código ${code}`);
    }

    return this.prisma.boSupplier.create({
      data: {
        code,
        name: dto.name.trim(),
        taxId: dto.taxId?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        address: dto.address?.trim() || null,
        active: dto.active ?? true,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.boSupplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return this.prisma.boSupplier.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        taxId: dto.taxId !== undefined ? (dto.taxId?.trim() || null) : undefined,
        phone: dto.phone !== undefined ? (dto.phone?.trim() || null) : undefined,
        email: dto.email !== undefined ? (dto.email?.trim() || null) : undefined,
        address: dto.address !== undefined ? (dto.address?.trim() || null) : undefined,
        active: dto.active !== undefined ? dto.active : undefined,
      },
    });
  }

  async toggleSupplier(id: string) {
    const supplier = await this.prisma.boSupplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    return this.prisma.boSupplier.update({
      where: { id },
      data: { active: !supplier.active },
    });
  }
}
