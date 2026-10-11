import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Optional,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsBroadcastService } from '../alerts/alerts-broadcast.service';
import {
  CreateTransferDto,
  DispatchTransferDto,
  ReceiveTransferDto,
  CancelTransferDto,
} from './dto/create-transfer.dto';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(AlertsBroadcastService)
    private readonly alertsBroadcastService?: AlertsBroadcastService,
  ) {}

  async createTransfer(dto: CreateTransferDto) {
    const fromStore = (dto.fromStoreCode || '').trim();
    const toStore = (dto.toStoreCode || '').trim();
    const requestedBy = (dto.requestedBy || 'OPERATOR').trim();

    if (!fromStore || !toStore) {
      throw new BadRequestException('Se requieren las sucursales de origen y destino');
    }

    if (fromStore === toStore) {
      throw new BadRequestException('La sucursal de origen y destino no pueden ser iguales');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('El traspaso debe contener al menos un producto');
    }

    for (const item of dto.items) {
      if (!item.productCode || Number(item.quantity) <= 0) {
        throw new BadRequestException('Todos los productos deben tener código y cantidad mayor a cero');
      }
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const transferNo = `TRF-${dateStr}-${randomSuffix}`;

    const transfer = await this.prisma.boStockTransfer.create({
      data: {
        transferNo,
        fromStoreCode: fromStore,
        toStoreCode: toStore,
        status: 'REQUESTED',
        requestedBy,
        notes: dto.notes ?? null,
        items: {
          create: dto.items.map((it) => ({
            productCode: it.productCode.trim(),
            productName: it.productName?.trim() ?? null,
            quantityRequested: it.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    this.logger.log(`Created transfer ${transfer.transferNo} from ${fromStore} to ${toStore}`);

    this.alertsBroadcastService?.emit({
      id: `transfer-created-${transfer.id}`,
      type: 'STOCK_TRANSFER',
      severity: 'WARNING',
      title: `Solicitud de Traspaso ${transfer.transferNo}`,
      description: `Sucursal ${fromStore} solicitó traspaso hacia ${toStore}`,
      storeCode: toStore,
      timestamp: new Date().toISOString(),
      link: '/transfers',
      metadata: { transferNo: transfer.transferNo, status: 'REQUESTED' },
    });

    return transfer;
  }

  async getTransfers(filters?: { storeCode?: string; status?: string }) {
    const where: any = {};

    if (filters?.storeCode) {
      const code = filters.storeCode.trim();
      where.OR = [
        { fromStoreCode: code },
        { toStoreCode: code },
      ];
    }

    if (filters?.status && filters.status.trim()) {
      where.status = filters.status.trim();
    }

    return this.prisma.boStockTransfer.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getTransferById(id: string) {
    const transfer = await this.prisma.boStockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transfer) {
      throw new NotFoundException(`Traspaso no encontrado: ${id}`);
    }

    return transfer;
  }

  async approveTransfer(id: string, approvedBy: string = 'HQ_ADMIN') {
    const transfer = await this.getTransferById(id);

    if (transfer.status !== 'REQUESTED') {
      throw new BadRequestException(
        `No se puede aprobar un traspaso en estado ${transfer.status}. Debe estar en REQUESTED.`,
      );
    }

    return this.prisma.boStockTransfer.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
      include: { items: true },
    });
  }

  async dispatchTransfer(id: string, dto?: DispatchTransferDto) {
    const transfer = await this.getTransferById(id);

    if (transfer.status !== 'APPROVED') {
      throw new BadRequestException(
        `No se puede despachar un traspaso en estado ${transfer.status}. Debe estar en APPROVED.`,
      );
    }

    const dispatchedBy = dto?.dispatchedBy || 'HQ_OPERATOR';

    const result = await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const itemOverride = dto?.items?.find((i) => i.productCode === item.productCode);
        const qtyToDispatch = Number(itemOverride ? itemOverride.quantity : item.quantityRequested);

        const currentOriginStock = await tx.boInventory.findUnique({
          where: {
            storeCode_productCode: {
              storeCode: transfer.fromStoreCode,
              productCode: item.productCode,
            },
          },
        });

        const available = currentOriginStock ? Number(currentOriginStock.stock) : 0;
        if (available < qtyToDispatch) {
          throw new BadRequestException(
            `Stock insuficiente en sucursal ${transfer.fromStoreCode} para el producto ${item.productCode}. Disponible: ${available}, Requerido: ${qtyToDispatch}`,
          );
        }

        // Decrement origin store stock
        await tx.boInventory.update({
          where: {
            storeCode_productCode: {
              storeCode: transfer.fromStoreCode,
              productCode: item.productCode,
            },
          },
          data: {
            stock: { decrement: qtyToDispatch },
          },
        });

        // Update item dispatched qty
        await tx.boStockTransferItem.update({
          where: { id: item.id },
          data: {
            quantityDispatched: qtyToDispatch,
          },
        });
      }

      return tx.boStockTransfer.update({
        where: { id },
        data: {
          status: 'IN_TRANSIT',
          dispatchedBy,
          dispatchedAt: new Date(),
        },
        include: { items: true },
      });
    });

    this.alertsBroadcastService?.emit({
      id: `transfer-dispatched-${result.id}`,
      type: 'STOCK_TRANSFER',
      severity: 'INFO',
      title: `Traspaso ${result.transferNo} en Tránsito`,
      description: `Sucursal ${result.fromStoreCode} despachó mercancía hacia ${result.toStoreCode}`,
      storeCode: result.toStoreCode,
      timestamp: new Date().toISOString(),
      link: '/transfers',
      metadata: {
        transferNo: result.transferNo,
        fromStoreCode: result.fromStoreCode,
        toStoreCode: result.toStoreCode,
        status: 'IN_TRANSIT',
      },
    });

    return result;
  }

  async receiveTransfer(id: string, dto?: ReceiveTransferDto, user?: any) {
    const transfer = await this.getTransferById(id);

    if (transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException(
        `No se puede recibir un traspaso en estado ${transfer.status}. Debe estar en IN_TRANSIT.`,
      );
    }

    // 1. Validar autorización de tienda (Solo la tienda destino o admin global)
    if (user) {
      const isSuperAdmin =
        user.role === 'SUPER_ADMIN' ||
        user.role === 'ADMIN' ||
        user.roles?.includes('SUPER_ADMIN') ||
        user.roles?.includes('ADMIN');

      if (!isSuperAdmin && user.storeCode && user.storeCode !== transfer.toStoreCode) {
        throw new ForbiddenException(
          `Solo el personal de la sucursal receptora (${transfer.toStoreCode}) o un administrador global puede confirmar la recepción.`,
        );
      }
    }

    const receivedBy = dto?.receivedBy || user?.username || 'HQ_OPERATOR';

    // 2. Evaluar discrepancias en los artículos recibidos vs despachados
    let hasDiscrepancy = false;
    for (const item of transfer.items) {
      const itemOverride = dto?.items?.find((i) => i.productCode === item.productCode);
      const qtyDispatched = Number(item.quantityDispatched ?? item.quantityRequested);
      const qtyToReceive = Number(
        itemOverride ? itemOverride.quantity : qtyDispatched,
      );
      if (qtyToReceive !== qtyDispatched) {
        hasDiscrepancy = true;
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const itemOverride = dto?.items?.find((i) => i.productCode === item.productCode);
        const qtyDispatched = Number(item.quantityDispatched ?? item.quantityRequested);
        const qtyToReceive = Number(
          itemOverride ? itemOverride.quantity : qtyDispatched,
        );
        const variance = qtyToReceive - qtyDispatched;

        // Increment destination store stock (upsert if not present)
        await tx.boInventory.upsert({
          where: {
            storeCode_productCode: {
              storeCode: transfer.toStoreCode,
              productCode: item.productCode,
            },
          },
          update: {
            stock: { increment: qtyToReceive },
            ...(item.productName ? { productName: item.productName } : {}),
          },
          create: {
            storeCode: transfer.toStoreCode,
            productCode: item.productCode,
            productName: item.productName ?? null,
            stock: qtyToReceive,
            minStock: 0,
          },
        });

        // Update item received qty
        await tx.boStockTransferItem.update({
          where: { id: item.id },
          data: {
            quantityReceived: qtyToReceive,
          },
        });

        // Registrar merma o sobrante en log de actividad si hay discrepancia
        if (variance !== 0) {
          const reason = itemOverride?.reason || dto?.discrepancyReason || 'FALTANTE_RECEPCION';
          await tx.activityLog.create({
            data: {
              action: variance < 0 ? 'TRANSFER_SHRINKAGE' : 'TRANSFER_SURPLUS',
              entity: 'STOCK_TRANSFER',
              entityId: transfer.id,
              storeCode: transfer.toStoreCode,
              userId: receivedBy,
              metadata: JSON.stringify({
                transferNo: transfer.transferNo,
                fromStoreCode: transfer.fromStoreCode,
                toStoreCode: transfer.toStoreCode,
                productCode: item.productCode,
                quantityDispatched: qtyDispatched,
                quantityReceived: qtyToReceive,
                variance,
                reason,
                notes: itemOverride?.notes || dto?.discrepancyNotes,
              }),
            },
          });
        }
      }

      const finalStatus = hasDiscrepancy ? 'RECEIVED_WITH_DISCREPANCY' : 'RECEIVED';
      const reasonLabel = dto?.discrepancyReason ? ` [Motivo: ${dto.discrepancyReason}]` : '';
      const notesLabel = dto?.discrepancyNotes ? ` [Notas: ${dto.discrepancyNotes}]` : '';
      const updatedNotes = ((transfer.notes || '') + reasonLabel + notesLabel).trim() || null;

      return tx.boStockTransfer.update({
        where: { id },
        data: {
          status: finalStatus,
          receivedBy,
          receivedAt: new Date(),
          notes: updatedNotes,
        },
        include: { items: true },
      });
    });

    // 3. Emitir evento SSE en tiempo real
    if (hasDiscrepancy) {
      this.alertsBroadcastService?.emit({
        id: `discrepancy-${result.id}`,
        type: 'TRANSFER_DISCREPANCY',
        severity: 'CRITICAL',
        title: `Traspaso ${result.transferNo} Recibido con Discrepancia`,
        description: `Sucursal ${result.toStoreCode} reportó diferencias en recepción desde ${result.fromStoreCode}`,
        storeCode: result.toStoreCode,
        timestamp: new Date().toISOString(),
        link: '/transfers',
        metadata: {
          transferNo: result.transferNo,
          fromStoreCode: result.fromStoreCode,
          toStoreCode: result.toStoreCode,
          status: result.status,
        },
      });
    } else {
      this.alertsBroadcastService?.emit({
        id: `transfer-received-${result.id}`,
        type: 'STOCK_TRANSFER',
        severity: 'INFO',
        title: `Traspaso ${result.transferNo} Recibido Completo`,
        description: `Sucursal ${result.toStoreCode} recibió mercancía completa desde ${result.fromStoreCode}`,
        storeCode: result.toStoreCode,
        timestamp: new Date().toISOString(),
        link: '/transfers',
        metadata: {
          transferNo: result.transferNo,
          status: 'RECEIVED',
        },
      });
    }

    return result;
  }

  async cancelTransfer(id: string, dto?: CancelTransferDto) {
    const transfer = await this.getTransferById(id);

    if (transfer.status === 'IN_TRANSIT' || transfer.status === 'RECEIVED') {
      throw new BadRequestException(
        `No se puede cancelar un traspaso en estado ${transfer.status}. La mercancía ya está en tránsito o ha sido recibida.`,
      );
    }

    if (transfer.status === 'CANCELLED') {
      return transfer;
    }

    const reason = dto?.reason ? ` [Cancelado: ${dto.reason}]` : ' [Cancelado]';
    const updatedNotes = (transfer.notes || '') + reason;

    return this.prisma.boStockTransfer.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: updatedNotes.trim(),
      },
      include: { items: true },
    });
  }
}
