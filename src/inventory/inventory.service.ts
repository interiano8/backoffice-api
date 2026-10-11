import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NetworkInventoryItem {
  storeCode: string;
  storeName: string;
  stock: number;
  minStock: number;
  isAvailable: boolean;
  updatedAt: string | null;
}

export interface NetworkInventoryResponse {
  productCode: string;
  items: NetworkInventoryItem[];
  totalNetworkStock: number;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getNetworkInventory(productCode: string): Promise<NetworkInventoryResponse> {
    const cleanCode = (productCode || '').trim();
    if (!cleanCode) {
      return { productCode: '', items: [], totalNetworkStock: 0 };
    }

    const stores = await this.prisma.boStore.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    });

    const inventories = await this.prisma.boInventory.findMany({
      where: { productCode: cleanCode },
    });

    const invMap = new Map<string, (typeof inventories)[0]>();
    for (const inv of inventories) {
      invMap.set(inv.storeCode, inv);
    }

    let totalNetworkStock = 0;
    const items: NetworkInventoryItem[] = stores.map((store) => {
      const inv = invMap.get(store.code);
      const stock = inv ? Number(inv.stock) : 0;
      const minStock = inv ? Number(inv.minStock) : 0;
      totalNetworkStock += stock;

      return {
        storeCode: store.code,
        storeName: store.name,
        stock,
        minStock,
        isAvailable: stock > 0,
        updatedAt: inv?.updatedAt ? inv.updatedAt.toISOString() : null,
      };
    });

    return {
      productCode: cleanCode,
      items,
      totalNetworkStock,
    };
  }

  async getStoreInventory(storeCode: string, productCode: string) {
    const cleanStore = (storeCode || '').trim();
    const cleanProduct = (productCode || '').trim();

    const inv = await this.prisma.boInventory.findUnique({
      where: {
        storeCode_productCode: {
          storeCode: cleanStore,
          productCode: cleanProduct,
        },
      },
    });

    const stock = inv ? Number(inv.stock) : 0;
    const minStock = inv ? Number(inv.minStock) : 0;

    return {
      storeCode: cleanStore,
      productCode: cleanProduct,
      productName: inv?.productName ?? null,
      stock,
      minStock,
      isAvailable: stock > 0,
      updatedAt: inv?.updatedAt ? inv.updatedAt.toISOString() : null,
    };
  }

  async adjustStock(
    storeCode: string,
    productCode: string,
    quantityDelta: number,
    productName?: string,
    minStock?: number,
  ) {
    const cleanStore = (storeCode || '').trim();
    const cleanProduct = (productCode || '').trim();

    const result = await this.prisma.boInventory.upsert({
      where: {
        storeCode_productCode: {
          storeCode: cleanStore,
          productCode: cleanProduct,
        },
      },
      update: {
        stock: { increment: quantityDelta },
        ...(productName ? { productName } : {}),
        ...(minStock !== undefined ? { minStock } : {}),
      },
      create: {
        storeCode: cleanStore,
        productCode: cleanProduct,
        productName: productName ?? null,
        stock: quantityDelta,
        minStock: minStock ?? 0,
      },
    });

    return {
      storeCode: result.storeCode,
      productCode: result.productCode,
      stock: Number(result.stock),
      minStock: Number(result.minStock),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  async getLowStockAlerts(storeCode?: string) {
    const where: any = {};
    if (storeCode) {
      where.storeCode = storeCode.trim();
    }

    const stores = await this.prisma.boStore.findMany({
      select: { code: true, name: true },
    });
    const storeMap = new Map(stores.map((s) => [s.code, s.name]));

    const inventories = await this.prisma.boInventory.findMany({
      where,
      orderBy: { storeCode: 'asc' },
    });

    const lowStockItems = inventories
      .map((inv) => {
        const stock = Number(inv.stock);
        const minStock = Number(inv.minStock);

        // Only evaluate if minStock is defined (> 0) and current stock <= minStock
        if (minStock <= 0 || stock > minStock) {
          return null;
        }

        let criticality: 'OUT_OF_STOCK' | 'CRITICAL' | 'WARNING';
        if (stock <= 0) {
          criticality = 'OUT_OF_STOCK';
        } else if (stock <= minStock * 0.5) {
          criticality = 'CRITICAL';
        } else {
          criticality = 'WARNING';
        }

        const suggestedReorder = Math.max(minStock * 2 - stock, 0);

        return {
          id: inv.id,
          storeCode: inv.storeCode,
          storeName: storeMap.get(inv.storeCode) || inv.storeCode,
          productCode: inv.productCode,
          productName: inv.productName,
          stock,
          minStock,
          criticality,
          suggestedReorder,
          updatedAt: inv.updatedAt.toISOString(),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Sort: OUT_OF_STOCK first, then CRITICAL, then WARNING
    const priority = { OUT_OF_STOCK: 1, CRITICAL: 2, WARNING: 3 };
    lowStockItems.sort((a, b) => priority[a.criticality] - priority[b.criticality]);

    return lowStockItems;
  }

  async updateThresholds(storeCode: string, items: Array<{ productCode: string; minStock: number }>) {
    const cleanStore = storeCode.trim();

    return this.prisma.$transaction(async (tx) => {
      const results: Array<{ storeCode: string; productCode: string; minStock: number }> = [];
      for (const item of items) {

        const cleanProduct = item.productCode.trim();
        const minStock = Number(item.minStock);

        const updated = await tx.boInventory.upsert({
          where: {
            storeCode_productCode: {
              storeCode: cleanStore,
              productCode: cleanProduct,
            },
          },
          update: { minStock },
          create: {
            storeCode: cleanStore,
            productCode: cleanProduct,
            stock: 0,
            minStock,
          },
        });

        results.push({
          storeCode: updated.storeCode,
          productCode: updated.productCode,
          minStock: Number(updated.minStock),
        });
      }
      return results;
    });
  }
}

