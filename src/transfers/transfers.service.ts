import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTransferDto,
  DispatchTransferDto,
  ReceiveTransferDto,
  CancelTransferDto,
} from './dto/create-transfer.dto';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.$transaction(async (tx) => {
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
  }

  async receiveTransfer(id: string, dto?: ReceiveTransferDto) {
    const transfer = await this.getTransferById(id);

    if (transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException(
        `No se puede recibir un traspaso en estado ${transfer.status}. Debe estar en IN_TRANSIT.`,
      );
    }

    const receivedBy = dto?.receivedBy || 'HQ_OPERATOR';

    return this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const itemOverride = dto?.items?.find((i) => i.productCode === item.productCode);
        const qtyToReceive = Number(
          itemOverride
            ? itemOverride.quantity
            : item.quantityDispatched ?? item.quantityRequested,
        );

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
      }

      return tx.boStockTransfer.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedBy,
          receivedAt: new Date(),
        },
        include: { items: true },
      });
    });
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
