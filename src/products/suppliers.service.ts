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
    let code = dto.code?.trim().toUpperCase();
    if (code) {
      const existing = await this.prisma.boSupplier.findUnique({
        where: { code },
      });
      if (existing) {
        throw new BadRequestException(`Ya existe un proveedor con el código ${code}`);
      }
    } else {
      const existingSups = await this.prisma.boSupplier.findMany({
        where: { code: { startsWith: 'PRV-' } },
        select: { code: true },
      });
      const numbers = existingSups
        .map((s) => {
          const match = s.code.match(/^PRV-(\d+)$/i);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);
      let nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      code = `PRV-${String(nextNum).padStart(5, '0')}`;
      while (await this.prisma.boSupplier.findUnique({ where: { code } })) {
        nextNum++;
        code = `PRV-${String(nextNum).padStart(5, '0')}`;
      }
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
