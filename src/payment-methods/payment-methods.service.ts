import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { SyncService } from '../sync/sync.service';

@Injectable()
export class PaymentMethodsService {
  private readonly logger = new Logger(PaymentMethodsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
  ) {}

  async generateNextCode(): Promise<string> {
    const existing = await this.prisma.boPaymentMethodCatalog.findMany({
      select: { code: true },
    });
    let maxNum = 1000;
    for (const item of existing) {
      const parsed = parseInt(item.code, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
    return String(maxNum + 1);
  }

  async createPaymentMethod(dto: CreatePaymentMethodDto) {
    const code = await this.generateNextCode();

    const created = await this.prisma.$transaction(async (tx) => {
      const pm = await tx.boPaymentMethodCatalog.create({
        data: {
          code,
          description: dto.description.trim(),
          category: (dto.category || 'EFECTIVO').trim().toUpperCase(),
          currency: (dto.currency || 'HNL').trim().toUpperCase(),
          generatesChange: dto.generatesChange ?? false,
          invoiceCash: dto.invoiceCash ?? false,
          invoiceCredit: dto.invoiceCredit ?? false,
          fuelOutflow: dto.fuelOutflow ?? false,
          loyalty: dto.loyalty ?? false,
          requiresReference: dto.requiresReference ?? false,
          image: dto.image || null,
          active: dto.active ?? true,
          accountId: dto.accountId || null,
          commissionPct: dto.commissionPct !== undefined ? dto.commissionPct : null,
        },
      });

      if (dto.storeCodes && dto.storeCodes.length > 0) {
        await tx.boStorePaymentMethod.createMany({
          data: dto.storeCodes.map((storeCode) => ({
            storeCode: storeCode.trim(),
            paymentCode: code,
            active: true,
          })),
        });
      }

      return pm;
    });

    this.syncService.bumpMasterVersion();

    return {
      success: true,
      message: `Forma de pago creada exitosamente. Código asignado: ${code}`,
      assignedCode: code,
      data: created,
    };
  }

  async findAllPaymentMethods() {
    const items = await this.prisma.boPaymentMethodCatalog.findMany({
      include: {
        storeAssignments: true,
      },
      orderBy: { code: 'asc' },
    });

    return items.map((item) => ({
      ...item,
      storeCodes: item.storeAssignments.map((sa) => sa.storeCode),
    }));
  }

  async findOnePaymentMethod(code: string) {
    const item = await this.prisma.boPaymentMethodCatalog.findUnique({
      where: { code },
      include: { storeAssignments: true },
    });
    if (!item) {
      throw new NotFoundException(`Forma de pago con código ${code} no encontrada.`);
    }
    return {
      ...item,
      storeCodes: item.storeAssignments.map((sa) => sa.storeCode),
    };
  }

  async updatePaymentMethod(code: string, dto: UpdatePaymentMethodDto) {
    const existing = await this.prisma.boPaymentMethodCatalog.findUnique({ where: { code } });
    if (!existing) {
      throw new NotFoundException(`Forma de pago con código ${code} no encontrada.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const pm = await tx.boPaymentMethodCatalog.update({
        where: { code },
        data: {
          ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
          ...(dto.category !== undefined ? { category: dto.category.trim().toUpperCase() } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency.trim().toUpperCase() } : {}),
          ...(dto.generatesChange !== undefined ? { generatesChange: dto.generatesChange } : {}),
          ...(dto.invoiceCash !== undefined ? { invoiceCash: dto.invoiceCash } : {}),
          ...(dto.invoiceCredit !== undefined ? { invoiceCredit: dto.invoiceCredit } : {}),
          ...(dto.fuelOutflow !== undefined ? { fuelOutflow: dto.fuelOutflow } : {}),
          ...(dto.loyalty !== undefined ? { loyalty: dto.loyalty } : {}),
          ...(dto.requiresReference !== undefined ? { requiresReference: dto.requiresReference } : {}),
          ...(dto.image !== undefined ? { image: dto.image } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.accountId !== undefined ? { accountId: dto.accountId } : {}),
          ...(dto.commissionPct !== undefined ? { commissionPct: dto.commissionPct } : {}),
        },
      });

      if (dto.storeCodes !== undefined) {
        await tx.boStorePaymentMethod.deleteMany({ where: { paymentCode: code } });
        if (dto.storeCodes.length > 0) {
          await tx.boStorePaymentMethod.createMany({
            data: dto.storeCodes.map((storeCode) => ({
              storeCode: storeCode.trim(),
              paymentCode: code,
              active: true,
            })),
          });
        }
      }

      return pm;
    });

    this.syncService.bumpMasterVersion();

    return updated;
  }

  async deletePaymentMethod(code: string) {
    const existing = await this.prisma.boPaymentMethodCatalog.findUnique({ where: { code } });
    if (!existing) {
      throw new NotFoundException(`Forma de pago con código ${code} no encontrada.`);
    }

    await this.prisma.boPaymentMethodCatalog.delete({ where: { code } });
    this.syncService.bumpMasterVersion();

    return { success: true, message: `Forma de pago ${code} eliminada.` };
  }

  async assignStoresToPaymentMethod(code: string, storeCodes: string[]) {
    const existing = await this.prisma.boPaymentMethodCatalog.findUnique({ where: { code } });
    if (!existing) {
      throw new NotFoundException(`Forma de pago con código ${code} no encontrada.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.boStorePaymentMethod.deleteMany({ where: { paymentCode: code } });
      if (storeCodes.length > 0) {
        await tx.boStorePaymentMethod.createMany({
          data: storeCodes.map((storeCode) => ({
            storeCode: storeCode.trim(),
            paymentCode: code,
            active: true,
          })),
        });
      }
    });

    this.syncService.bumpMasterVersion();

    return { success: true, message: `Estaciones asignadas correctamente a la forma de pago ${code}.` };
  }

  // ===== EXCHANGE RATES =====

  async createExchangeRate(dto: CreateExchangeRateDto) {
    const created = await this.prisma.boExchangeRate.create({
      data: {
        currency: (dto.currency || 'USD').trim().toUpperCase(),
        rate: dto.rate,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        active: dto.active ?? true,
      },
    });

    this.syncService.bumpMasterVersion();
    return created;
  }

  async findAllExchangeRates() {
    return this.prisma.boExchangeRate.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  async updateExchangeRate(id: string, dto: Partial<CreateExchangeRateDto>) {
    const existing = await this.prisma.boExchangeRate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Tasa de cambio con ID ${id} no encontrada.`);
    }

    const updated = await this.prisma.boExchangeRate.update({
      where: { id },
      data: {
        ...(dto.currency !== undefined ? { currency: dto.currency.trim().toUpperCase() } : {}),
        ...(dto.rate !== undefined ? { rate: dto.rate } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });

    this.syncService.bumpMasterVersion();
    return updated;
  }

  async deleteExchangeRate(id: string) {
    const existing = await this.prisma.boExchangeRate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Tasa de cambio con ID ${id} no encontrada.`);
    }

    await this.prisma.boExchangeRate.delete({ where: { id } });
    this.syncService.bumpMasterVersion();

    return { success: true, message: `Tasa de cambio eliminada.` };
  }
}
