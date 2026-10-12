import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductPriceDto, UpdateProductPriceDto } from './dto/product-price.dto';

@Injectable()
export class ProductPricesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPrices(filters?: {
    productId?: string;
    storeCode?: string;
    activeOnly?: boolean;
  }) {
    const where: any = {};
    if (filters?.productId) {
      where.productId = filters.productId;
    }
    if (filters?.storeCode) {
      where.OR = [
        { storeCode: filters.storeCode },
        { storeCode: null },
      ];
    }
    if (filters?.activeOnly) {
      where.active = true;
    }

    return this.prisma.boProductPrice.findMany({
      where,
      include: {
        product: true,
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createPrice(dto: CreateProductPriceDto) {
    const product = await this.prisma.boProduct.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    if (endDate && endDate < startDate) {
      throw new BadRequestException('La fecha final no puede ser anterior a la fecha inicial');
    }

    const storeCode = dto.storeCode?.trim() || null;

    return this.prisma.boProductPrice.create({
      data: {
        productId: dto.productId,
        storeCode,
        unitPrice: dto.unitPrice,
        startDate,
        endDate,
        currencyCode: dto.currencyCode?.trim() || 'HNL',
        active: dto.active ?? true,
      },
      include: {
        product: true,
      },
    });
  }

  async updatePrice(id: string, dto: UpdateProductPriceDto) {
    const price = await this.prisma.boProductPrice.findUnique({ where: { id } });
    if (!price) {
      throw new NotFoundException('Registro de precio no encontrado');
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : price.startDate;
    const endDate = dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : price.endDate;

    if (endDate && endDate < startDate) {
      throw new BadRequestException('La fecha final no puede ser anterior a la fecha inicial');
    }

    return this.prisma.boProductPrice.update({
      where: { id },
      data: {
        unitPrice: dto.unitPrice !== undefined ? dto.unitPrice : undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate,
        currencyCode: dto.currencyCode?.trim(),
        active: dto.active !== undefined ? dto.active : undefined,
      },
      include: {
        product: true,
      },
    });
  }

  async togglePrice(id: string) {
    const price = await this.prisma.boProductPrice.findUnique({ where: { id } });
    if (!price) {
      throw new NotFoundException('Registro de precio no encontrado');
    }
    return this.prisma.boProductPrice.update({
      where: { id },
      data: { active: !price.active },
    });
  }
}
