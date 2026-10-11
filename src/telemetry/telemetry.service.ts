import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { AlertsBroadcastService } from '../alerts/alerts-broadcast.service';

export interface StationHealthRecord {
  storeCode: string;
  storeName: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  fusionStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  pendingSyncCount: number;
  posVersion?: string;
  ipAddress?: string;
  lastPingAt: string | null;
  secondsSinceLastPing: number;
  metadata?: Record<string, any>;
}

export interface TelemetrySummaryResponse {
  total: number;
  online: number;
  degraded: number;
  offline: number;
  stations: StationHealthRecord[];
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly inMemoryHeartbeats = new Map<
    string,
    {
      storeCode: string;
      storeName?: string;
      fusionStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
      pendingSyncCount: number;
      posVersion?: string;
      ipAddress?: string;
      lastPingAt: Date;
      metadata?: Record<string, any>;
    }
  >();

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(AlertsBroadcastService)
    private readonly alertsBroadcastService?: AlertsBroadcastService,
  ) {}

  async recordHeartbeat(dto: HeartbeatDto, clientIp?: string) {
    const storeCode = dto.storeCode.trim();
    const now = new Date();
    const fusionStatus = (dto.fusionStatus as 'ONLINE' | 'OFFLINE' | 'UNKNOWN') || 'ONLINE';
    const pendingSyncCount = Number(dto.pendingSyncCount ?? 0);

    const prev = this.inMemoryHeartbeats.get(storeCode);

    this.inMemoryHeartbeats.set(storeCode, {
      storeCode,
      storeName: dto.storeName,
      fusionStatus,
      pendingSyncCount,
      posVersion: dto.posVersion,
      ipAddress: dto.ipAddress || clientIp,
      lastPingAt: now,
      metadata: dto.metadata,
    });

    // Actualizar lastSeenAt de la tienda en base de datos si existe
    try {
      await this.prisma.boStore.updateMany({
        where: { code: storeCode },
        data: { lastSeenAt: now },
      });
    } catch {
      // Ignorar error de base de datos para no bloquear el latido
    }

    // Alerta si el puente del controlador Fusion cayó en la estación
    if (fusionStatus === 'OFFLINE' && (!prev || prev.fusionStatus !== 'OFFLINE')) {
      this.alertsBroadcastService?.emit({
        id: `station-fusion-offline-${storeCode}-${Date.now()}`,
        type: 'STATION_STATUS',
        severity: 'CRITICAL',
        title: `Controlador Wayne Fusion Desconectado en Tienda ${storeCode}`,
        description: `La estación ${dto.storeName || storeCode} reporta pérdida de comunicación con las bombas/Fusion`,
        storeCode,
        timestamp: now.toISOString(),
        link: '/tiendas',
        metadata: { storeCode, fusionStatus: 'OFFLINE' },
      });
    }

    return {
      success: true,
      storeCode,
      serverTime: now.toISOString(),
    };
  }

  async getAllStatuses(): Promise<TelemetrySummaryResponse> {
    const stores = await this.prisma.boStore.findMany({
      where: { isActive: true },
      select: { code: true, name: true, lastSeenAt: true },
      orderBy: { code: 'asc' },
    });

    const now = Date.now();
    let onlineCount = 0;
    let degradedCount = 0;
    let offlineCount = 0;

    const stations: StationHealthRecord[] = stores.map((store) => {
      const memory = this.inMemoryHeartbeats.get(store.code);
      const lastPing = memory?.lastPingAt || store.lastSeenAt;

      if (!lastPing) {
        offlineCount++;
        return {
          storeCode: store.code,
          storeName: store.name,
          status: 'OFFLINE',
          fusionStatus: 'UNKNOWN',
          pendingSyncCount: 0,
          lastPingAt: null,
          secondsSinceLastPing: -1,
        };
      }

      const secondsSince = Math.max(0, Math.floor((now - lastPing.getTime()) / 1000));
      const fusionStatus = memory?.fusionStatus || 'UNKNOWN';
      const pendingSyncCount = memory?.pendingSyncCount ?? 0;

      let status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';

      if (secondsSince <= 90) {
        if (fusionStatus === 'OFFLINE' || pendingSyncCount > 50) {
          status = 'DEGRADED';
          degradedCount++;
        } else {
          status = 'ONLINE';
          onlineCount++;
        }
      } else if (secondsSince <= 180) {
        status = 'DEGRADED';
        degradedCount++;
      } else {
        status = 'OFFLINE';
        offlineCount++;
      }

      return {
        storeCode: store.code,
        storeName: memory?.storeName || store.name,
        status,
        fusionStatus,
        pendingSyncCount,
        posVersion: memory?.posVersion,
        ipAddress: memory?.ipAddress,
        lastPingAt: lastPing.toISOString(),
        secondsSinceLastPing: secondsSince,
        metadata: memory?.metadata,
      };
    });

    return {
      total: stations.length,
      online: onlineCount,
      degraded: degradedCount,
      offline: offlineCount,
      stations,
    };
  }
}
