import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(filters?: {
    search?: string;
    departmentId?: string;
    categoryId?: string;
    activeOnly?: boolean;
  }) {
    const where: any = {};

    if (filters?.activeOnly) {
      where.active = true;
    }
    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { barcodes: { some: { barcode: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    return this.prisma.boProduct.findMany({
      where,
      include: {
        department: true,
        category: true,
        barcodes: { where: { active: true } },
        suppliers: {
          include: {
            supplier: true,
          },
        },
        prices: {
          where: { active: true },
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getProductById(id: string) {
    const product = await this.prisma.boProduct.findUnique({
      where: { id },
      include: {
        department: true,
        category: true,
        barcodes: true,
        suppliers: {
          include: {
            supplier: true,
          },
        },
        prices: {
          orderBy: { startDate: 'desc' },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async createProduct(dto: CreateProductDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.boProduct.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException(`Ya existe un producto con el código SKU ${code}`);
    }

    // Validar códigos de barra únicos
    if (dto.barcodes && dto.barcodes.length > 0) {
      const existingBarcode = await this.prisma.boProductBarcode.findFirst({
        where: {
          barcode: { in: dto.barcodes.map((b) => b.trim()) },
        },
      });
      if (existingBarcode) {
        throw new BadRequestException(
          `El código de barras ${existingBarcode.barcode} ya está asignado a otro producto`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.boProduct.create({
        data: {
          code,
          description: dto.description.trim(),
          departmentId: dto.departmentId || null,
          categoryId: dto.categoryId || null,
          unitOfMeasure: dto.unitOfMeasure?.trim() || 'UND',
          taxGroup: dto.taxGroup?.trim() || '15',
          imageUrl: dto.imageUrl?.trim() || null,
          active: dto.active ?? true,
        },
      });

      // Insertar códigos de barra
      if (dto.barcodes && dto.barcodes.length > 0) {
        const uniqueBarcodes = Array.from(new Set(dto.barcodes.map((b) => b.trim()).filter(Boolean)));
        await tx.boProductBarcode.createMany({
          data: uniqueBarcodes.map((barcode) => ({
            productId: product.id,
            barcode,
            active: true,
          })),
        });
      }

      // Insertar proveedores
      if (dto.suppliers && dto.suppliers.length > 0) {
        await tx.boProductSupplier.createMany({
          data: dto.suppliers.map((s) => ({
            productId: product.id,
            supplierId: s.supplierId,
            supplierProductCode: s.supplierProductCode?.trim() || null,
            isDefault: s.isDefault ?? false,
          })),
        });
      }

      return tx.boProduct.findUnique({
        where: { id: product.id },
        include: {
          department: true,
          category: true,
          barcodes: true,
          suppliers: { include: { supplier: true } },
          prices: true,
        },
      });
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.boProduct.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Si envía barcodes, validar duplicados en otros productos
    if (dto.barcodes && dto.barcodes.length > 0) {
      const existingBarcode = await this.prisma.boProductBarcode.findFirst({
        where: {
          barcode: { in: dto.barcodes.map((b) => b.trim()) },
          productId: { not: id },
        },
      });
      if (existingBarcode) {
        throw new BadRequestException(
          `El código de barras ${existingBarcode.barcode} ya está asignado a otro producto`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.boProduct.update({
        where: { id },
        data: {
          description: dto.description ? dto.description.trim() : undefined,
          departmentId: dto.departmentId !== undefined ? dto.departmentId : undefined,
          categoryId: dto.categoryId !== undefined ? dto.categoryId : undefined,
          unitOfMeasure: dto.unitOfMeasure !== undefined ? dto.unitOfMeasure.trim() : undefined,
          taxGroup: dto.taxGroup !== undefined ? dto.taxGroup.trim() : undefined,
          imageUrl: dto.imageUrl !== undefined ? (dto.imageUrl?.trim() || null) : undefined,
          active: dto.active !== undefined ? dto.active : undefined,
        },
      });

      if (dto.barcodes !== undefined) {
        // Reemplazar códigos de barra
        await tx.boProductBarcode.deleteMany({ where: { productId: id } });
        const uniqueBarcodes = Array.from(new Set(dto.barcodes.map((b) => b.trim()).filter(Boolean)));
        if (uniqueBarcodes.length > 0) {
          await tx.boProductBarcode.createMany({
            data: uniqueBarcodes.map((barcode) => ({
              productId: id,
              barcode,
              active: true,
            })),
          });
        }
      }

      if (dto.suppliers !== undefined) {
        // Reemplazar asignación de proveedores
        await tx.boProductSupplier.deleteMany({ where: { productId: id } });
        if (dto.suppliers.length > 0) {
          await tx.boProductSupplier.createMany({
            data: dto.suppliers.map((s) => ({
              productId: id,
              supplierId: s.supplierId,
              supplierProductCode: s.supplierProductCode?.trim() || null,
              isDefault: s.isDefault ?? false,
            })),
          });
        }
      }

      return tx.boProduct.findUnique({
        where: { id },
        include: {
          department: true,
          category: true,
          barcodes: true,
          suppliers: { include: { supplier: true } },
          prices: true,
        },
      });
    });
  }

  async toggleProduct(id: string) {
    const product = await this.prisma.boProduct.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return this.prisma.boProduct.update({
      where: { id },
      data: { active: !product.active },
    });
  }
}
