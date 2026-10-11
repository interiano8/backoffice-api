import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePromotionDto,
  EvaluatePromotionsDto,
} from './dto/promotion.dto';

export interface PromotionEvaluationResult {
  originalSubtotal: number;
  totalDiscount: number;
  finalTotal: number;
  appliedPromotions: Array<{
    promotionCode: string;
    promotionName: string;
    type: string;
    discountAmount: number;
    details: string;
  }>;
}

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPromotion(dto: CreatePromotionDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.boPromotion.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException(`Ya existe una promoción con el código ${code}`);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La promoción debe contener al menos un producto');
    }

    const promotion = await this.prisma.boPromotion.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        type: dto.type,
        fixedPrice: dto.fixedPrice !== undefined ? dto.fixedPrice : null,
        discountPct: dto.discountPct !== undefined ? dto.discountPct : null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        storeCode: dto.storeCode?.trim() || null,
        items: {
          create: dto.items.map((it) => ({
            productCode: it.productCode.trim(),
            productName: it.productName?.trim() ?? null,
            quantityRequired: it.quantityRequired,
            isReward: !!it.isReward,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    this.logger.log(`Created promotion ${promotion.code} (${promotion.type})`);
    return promotion;
  }

  async listPromotions(storeCode?: string, activeOnly: boolean = false) {
    const where: any = {};
    if (activeOnly) {
      where.active = true;
    }
    if (storeCode) {
      where.OR = [{ storeCode: null }, { storeCode: storeCode.trim() }];
    }

    return this.prisma.boPromotion.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPromotionById(id: string) {
    const promo = await this.prisma.boPromotion.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });
    if (!promo) {
      throw new NotFoundException(`Promoción no encontrada: ${id}`);
    }
    return promo;
  }

  async togglePromotion(id: string) {
    const promo = await this.getPromotionById(id);
    return this.prisma.boPromotion.update({
      where: { id },
      data: { active: !promo.active },
      include: { items: true },
    });
  }

  async deletePromotion(id: string) {
    await this.getPromotionById(id);
    return this.prisma.boPromotion.delete({
      where: { id },
    });
  }

  async evaluateCart(dto: EvaluatePromotionsDto): Promise<PromotionEvaluationResult> {
    const now = new Date();
    const where: any = {
      active: true,
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: null },
        { startDate: null, endDate: { gte: now } },
      ],
    };

    if (dto.storeCode) {
      where.AND = [
        {
          OR: [{ storeCode: null }, { storeCode: dto.storeCode.trim() }],
        },
      ];
    }

    const activePromos = await this.prisma.boPromotion.findMany({
      where,
      include: {
        items: true,
      },
    });

    // Calculate cart base totals
    const cartMap = new Map<string, { qty: number; unitPrice: number; productName: string }>();
    let originalSubtotal = 0;

    for (const it of dto.items) {
      const code = it.productCode.trim();
      const current = cartMap.get(code) || { qty: 0, unitPrice: it.unitPrice, productName: it.productName || '' };
      current.qty += Number(it.quantity);
      cartMap.set(code, current);
      originalSubtotal += Number(it.quantity) * Number(it.unitPrice);
    }

    let totalDiscount = 0;
    const appliedPromotions: PromotionEvaluationResult['appliedPromotions'] = [];

    // Evaluate each promo against the cart
    for (const promo of activePromos) {
      if (promo.type === 'FIXED_PRICE_COMBO') {
        // All items in combo must be present in sufficient quantities
        let canApply = true;
        let originalComboSum = 0;

        for (const req of promo.items) {
          const inCart = cartMap.get(req.productCode);
          const reqQty = Number(req.quantityRequired);
          if (!inCart || inCart.qty < reqQty) {
            canApply = false;
            break;
          }
          originalComboSum += reqQty * inCart.unitPrice;
        }

        if (canApply && promo.fixedPrice !== null) {
          const fixedPrice = Number(promo.fixedPrice);
          const discount = Math.max(originalComboSum - fixedPrice, 0);

          if (discount > 0) {
            totalDiscount += discount;
            appliedPromotions.push({
              promotionCode: promo.code,
              promotionName: promo.name,
              type: promo.type,
              discountAmount: discount,
              details: `Precio Combo L. ${fixedPrice.toFixed(2)} (Ahorro L. ${discount.toFixed(2)})`,
            });
          }
        }
      } else if (promo.type === 'PERCENT_DISCOUNT') {
        if (promo.discountPct !== null) {
          const pct = Number(promo.discountPct) / 100;
          let eligibleSum = 0;

          for (const req of promo.items) {
            const inCart = cartMap.get(req.productCode);
            if (inCart) {
              eligibleSum += inCart.qty * inCart.unitPrice;
            }
          }

          if (eligibleSum > 0) {
            const discount = Number((eligibleSum * pct).toFixed(2));
            totalDiscount += discount;
            appliedPromotions.push({
              promotionCode: promo.code,
              promotionName: promo.name,
              type: promo.type,
              discountAmount: discount,
              details: `${Number(promo.discountPct)}% de descuento sobre productos aplicables`,
            });
          }
        }
      }
    }

    const finalTotal = Math.max(originalSubtotal - totalDiscount, 0);

    return {
      originalSubtotal: Number(originalSubtotal.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
      appliedPromotions,
    };
  }
}
