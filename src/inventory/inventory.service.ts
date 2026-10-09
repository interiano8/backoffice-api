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
}
