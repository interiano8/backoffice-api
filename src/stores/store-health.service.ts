import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';

export interface StoreHealthInfo {
  id: string;
  code: string;
  name: string;
  ip: string;
  dbPort: number;
  dbName: string;
  isActive: boolean;
  healthStatus: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR';
  latencyMs: number | null;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

@Injectable()
export class StoreHealthService {
  private readonly logger = new Logger(StoreHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkStoreHealth(store: any): Promise<StoreHealthInfo> {
    const start = Date.now();
    const port = Number(store.dbPort) || 5432;
    const dbName = store.dbName || 'prisma';
    const user = store.dbUser || 'postgres';

    let healthStatus: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR' = 'ONLINE';
    let latencyMs: number | null = null;
    let lastSeenAt: Date | null = null;

    // Soporte para tiendas conectadas por Cloudflare Tunnel (sin IP/puerto TCP directo)
    const isCloudflared =
      store.ip === 'cloudflared' ||
      store.ip === 'tunnel' ||
      !store.ip;

    if (isCloudflared) {
      const lastSeen = store.lastSeenAt ? new Date(store.lastSeenAt).getTime() : 0;
      const isRecent = Date.now() - lastSeen < 5 * 60 * 1000; // Activo en los últimos 5 minutos

      healthStatus = isRecent ? 'ONLINE' : 'OFFLINE';
      latencyMs = isRecent ? (store.latencyMs || 25) : null;
      lastSeenAt = store.lastSeenAt ? new Date(store.lastSeenAt) : null;

      await this.prisma.boStore.update({
        where: { id: store.id },
        data: {
          healthStatus,
          latencyMs,
        },
      }).catch(() => {});

      return {
        id: store.id,
        code: store.code,
        name: store.name,
        ip: store.ip || 'cloudflared',
        dbPort: port,
        dbName,
        isActive: Boolean(store.isActive),
        healthStatus,
        latencyMs,
        lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
        lastSyncAt: store.lastSyncAt ? new Date(store.lastSyncAt).toISOString() : null,
        lastSyncStatus: store.lastSyncStatus || null,
        lastSyncError: store.lastSyncError || null,
      };
    }

    let dbPassword = store.dbPassword;
    if (!dbPassword && store.id) {
      const dbStore = await this.prisma.boStore.findUnique({
        where: { id: store.id },
        select: { dbPassword: true },
      });
      dbPassword = dbStore?.dbPassword ?? undefined;
    }

    const client = new Client({
      host: store.ip || '127.0.0.1',
      port,
      database: dbName,
      user,
      password: dbPassword ? String(dbPassword) : undefined,
      ssl: store.dbSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 4000,
    });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();

      latencyMs = Date.now() - start;
      lastSeenAt = new Date();
      healthStatus = 'ONLINE';

      await this.prisma.boStore.update({
        where: { id: store.id },
        data: {
          lastSeenAt,
          latencyMs,
          healthStatus: 'ONLINE',
        },
      });
    } catch (error: any) {
      healthStatus = 'OFFLINE';
      latencyMs = null;
      this.logger.warn(`Health check failed for store ${store.code} (${store.name}): ${error.message}`);

      try {
        await this.prisma.boStore.update({
          where: { id: store.id },
          data: {
            healthStatus: 'OFFLINE',
            latencyMs: null,
          },
        });
      } catch {}
    }

    return {
      id: store.id,
      code: store.code,
      name: store.name,
      ip: store.ip,
      dbPort: port,
      dbName,
      isActive: Boolean(store.isActive),
      healthStatus,
      latencyMs,
      lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : (store.lastSeenAt ? new Date(store.lastSeenAt).toISOString() : null),
      lastSyncAt: store.lastSyncAt ? new Date(store.lastSyncAt).toISOString() : null,
      lastSyncStatus: store.lastSyncStatus || null,
      lastSyncError: store.lastSyncError || null,
    };
  }

  async checkAllStoresHealth(): Promise<StoreHealthInfo[]> {
    const stores = await this.prisma.boStore.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const results: StoreHealthInfo[] = [];
    for (const store of stores) {
      const health = await this.checkStoreHealth(store);
      results.push(health);
    }
    return results;
  }

  async getHealthSummary(): Promise<StoreHealthInfo[]> {
    const stores = await this.prisma.boStore.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    return stores.map((store) => ({
      id: store.id,
      code: store.code,
      name: store.name,
      ip: store.ip,
      dbPort: store.dbPort || 5432,
      dbName: store.dbName || 'prisma',
      isActive: Boolean(store.isActive),
      healthStatus: (store.healthStatus as any) || 'ONLINE',
      latencyMs: store.latencyMs,
      lastSeenAt: store.lastSeenAt ? new Date(store.lastSeenAt).toISOString() : null,
      lastSyncAt: store.lastSyncAt ? new Date(store.lastSyncAt).toISOString() : null,
      lastSyncStatus: store.lastSyncStatus,
      lastSyncError: store.lastSyncError,
    }));
  }
}
