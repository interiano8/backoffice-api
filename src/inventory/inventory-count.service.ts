import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInventoryCountDto,
  UpdateInventoryCountItemsDto,
  ApplyInventoryCountDto,
  CancelInventoryCountDto,
} from './dto/inventory-count.dto';

@Injectable()
export class InventoryCountService {
  private readonly logger = new Logger(InventoryCountService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createCountSession(dto: CreateInventoryCountDto) {
    const storeCode = (dto.storeCode || '').trim();
    if (!storeCode) {
      throw new BadRequestException('El código de sucursal es obligatorio');
    }

    const countedBy = (dto.countedBy || 'AUDITOR').trim();

    // Check store existence
    const store = await this.prisma.boStore.findUnique({
      where: { code: storeCode },
    });
    if (!store) {
      throw new NotFoundException(`La sucursal ${storeCode} no existe`);
    }

    // Generate session number: CNT-YYYYMMDD-XXXX
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sessionNo = `CNT-${dateStr}-${randomSuffix}`;

    // Get snapshot of current inventory in store
    const storeInventories = await this.prisma.boInventory.findMany({
      where: { storeCode },
      orderBy: { productCode: 'asc' },
    });

    const session = await this.prisma.boInventoryCountSession.create({
      data: {
        sessionNo,
        storeCode,
        status: 'DRAFT',
        countedBy,
        notes: dto.notes ?? null,
        items: {
          create: storeInventories.map((inv) => {
            const theo = Number(inv.stock);
            return {
              productCode: inv.productCode,
              productName: inv.productName ?? null,
              theoreticalStock: theo,
              countedStock: theo, // default countedStock to theoretical
              variance: 0,
            };
          }),
        },
      },
      include: {
        items: {
          orderBy: { productCode: 'asc' },
        },
      },
    });

    this.logger.log(
      `Created inventory count session ${session.sessionNo} for store ${storeCode} with ${session.items.length} items`,
    );

    return session;
  }

  async listCountSessions(storeCode?: string, status?: string) {
    const where: any = {};
    if (storeCode) {
      where.storeCode = storeCode.trim();
    }
    if (status) {
      where.status = status.trim().toUpperCase();
    }

    return this.prisma.boInventoryCountSession.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCountSessionById(id: string) {
    const session = await this.prisma.boInventoryCountSession.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { productCode: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Sesión de conteo no encontrada: ${id}`);
    }

    return session;
  }

  async updateCountItems(id: string, dto: UpdateInventoryCountItemsDto) {
    const session = await this.getCountSessionById(id);

    if (session.status !== 'DRAFT' && session.status !== 'COMPLETED') {
      throw new BadRequestException(
        `No se pueden modificar items de una sesión en estado ${session.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const itemDto of dto.items) {
        const productCode = itemDto.productCode.trim();
        const countedStock = Number(itemDto.countedStock);

        // Find existing item in session
        const existingItem = session.items.find((i) => i.productCode === productCode);

        const theoreticalStock = existingItem ? Number(existingItem.theoreticalStock) : 0;
        const variance = countedStock - theoreticalStock;

        if (existingItem) {
          await tx.boInventoryCountItem.update({
            where: { id: existingItem.id },
            data: {
              countedStock,
              variance,
              reason: itemDto.reason ?? existingItem.reason,
              notes: itemDto.notes ?? existingItem.notes,
              ...(itemDto.productName ? { productName: itemDto.productName.trim() } : {}),
            },
          });
        } else {
          // If item is new/untracked
          await tx.boInventoryCountItem.create({
            data: {
              sessionId: session.id,
              productCode,
              productName: itemDto.productName?.trim() ?? null,
              theoreticalStock: 0,
              countedStock,
              variance: countedStock,
              reason: itemDto.reason ?? 'DESCUADRE_FISICO',
              notes: itemDto.notes ?? null,
            },
          });
        }
      }

      // Mark session as COMPLETED (counted and ready for review)
      await tx.boInventoryCountSession.update({
        where: { id },
        data: { status: 'COMPLETED' },
      });

      return tx.boInventoryCountSession.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { productCode: 'asc' },
          },
        },
      });
    });
  }

  async applyAdjustments(id: string, dto: ApplyInventoryCountDto) {
    const session = await this.getCountSessionById(id);

    if (session.status === 'APPLIED') {
      throw new BadRequestException('Esta sesión de conteo ya fue aplicada previamente');
    }
    if (session.status === 'CANCELLED') {
      throw new BadRequestException('No se puede aplicar una sesión cancelada');
    }

    const approvedBy = (dto.approvedBy || 'GERENCIA').trim();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Apply each item to BoInventory
      for (const item of session.items) {
        const countedStock = Number(item.countedStock);
        await tx.boInventory.upsert({
          where: {
            storeCode_productCode: {
              storeCode: session.storeCode,
              productCode: item.productCode,
            },
          },
          update: {
            stock: countedStock,
            ...(item.productName ? { productName: item.productName } : {}),
          },
          create: {
            storeCode: session.storeCode,
            productCode: item.productCode,
            productName: item.productName ?? null,
            stock: countedStock,
            minStock: 0,
          },
        });
      }

      // Mark session as APPLIED
      const updatedSession = await tx.boInventoryCountSession.update({
        where: { id },
        data: {
          status: 'APPLIED',
          approvedBy,
          appliedAt: now,
          notes: dto.notes ? `${session.notes ? session.notes + ' | ' : ''}${dto.notes}` : session.notes,
        },
        include: {
          items: {
            orderBy: { productCode: 'asc' },
          },
        },
      });

      // Register ActivityLog
      await tx.activityLog.create({
        data: {
          action: 'APPLY_INVENTORY_COUNT',
          entity: 'BoInventoryCountSession',
          entityId: session.id,
          storeCode: session.storeCode,
          userId: approvedBy,
          metadata: JSON.stringify({
            sessionNo: session.sessionNo,
            itemCount: session.items.length,
            appliedAt: now.toISOString(),
          }),
        },
      });

      this.logger.log(
        `Applied physical inventory session ${session.sessionNo} to store ${session.storeCode}`,
      );

      return updatedSession;
    });
  }

  async cancelCountSession(id: string, dto: CancelInventoryCountDto) {
    const session = await this.getCountSessionById(id);

    if (session.status === 'APPLIED') {
      throw new BadRequestException('No se puede cancelar una sesión que ya ha sido aplicada');
    }

    if (session.status === 'CANCELLED') {
      return session;
    }

    const updatedSession = await this.prisma.boInventoryCountSession.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: dto.notes ? `${session.notes ? session.notes + ' | ' : ''}${dto.notes}` : session.notes,
      },
      include: {
        items: true,
      },
    });

    this.logger.log(`Cancelled inventory count session ${session.sessionNo}`);
    return updatedSession;
  }
}
