import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Pool, PoolConfig } from "pg";
import { PrismaService } from "../../prisma/prisma.service";
import { IConnectionFactory } from "./connection-factory.interface";
import type { DbExecutor } from "./db-executor.interface";
import { PgExecutor } from "./pg-executor";

@Injectable()
export class PgConnectionFactory implements IConnectionFactory, OnModuleDestroy {
  private readonly logger = new Logger(PgConnectionFactory.name);
  private readonly pools = new Map<string, Pool>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy() {
    for (const [key, pool] of this.pools.entries()) {
      try {
        await pool.end();
      } catch (err: any) {
        this.logger.warn(`Error closing pool for ${key}: ${err.message}`);
      }
    }
    this.pools.clear();
  }

  private async getPoolForStore(storeCode: string): Promise<Pool> {
    if (this.pools.has(storeCode)) {
      return this.pools.get(storeCode)!;
    }

    const store = await this.prisma.boStore.findUnique({
      where: { code: storeCode },
    });

    let config: PoolConfig;

    if (!store) {
      this.logger.warn(`Store ${storeCode} not found in bo-prisma. Using fallback POS_DATABASE_URL`);
      const fallbackUrl = process.env.POS_DATABASE_URL || "postgresql://postgres@127.0.0.1:5432/prisma";
      config = {
        connectionString: fallbackUrl,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        max: 10,
      };
    } else {
      const host = store.ip && store.ip !== "localhost" && store.ip !== "127.0.0.1"
        ? store.ip
        : (process.env.POS_HOST || "127.0.0.1");
      const port = (store as any).dbPort || Number(process.env.POS_PORT) || 5432;
      const database = (store as any).dbName || process.env.POS_DATABASE || "prisma";
      const user = (store as any).dbUser || process.env.POS_USER || "postgres";
      const password = (store as any).dbPassword || process.env.POS_PASSWORD || undefined;

      this.logger.log(`[${storeCode}] Connecting to PostgreSQL: ${user}@${host}:${port}/${database}`);

      config = {
        host,
        port,
        database,
        user,
        password,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        max: 10,
        ssl: (store as any).dbSsl ? { rejectUnauthorized: false } : undefined,
      };
    }

    const pool = new Pool(config);

    pool.on("error", (err) => {
      this.logger.error(`Unexpected PG pool error on store ${storeCode}: ${err.message}`);
    });

    this.pools.set(storeCode, pool);
    return pool;
  }

  async getTpvConnection(storeCode: string): Promise<DbExecutor> {
    const pool = await this.getPoolForStore(storeCode);
    return new PgExecutor(pool);
  }

  async getTpvTransaction(storeCode: string): Promise<DbExecutor> {
    const pool = await this.getPoolForStore(storeCode);
    const client = await pool.connect();
    return new PgExecutor(client, true);
  }

  async getFusionConnection(storeCode: string): Promise<DbExecutor> {
    const pool = await this.getPoolForStore(storeCode);
    return new PgExecutor(pool);
  }
}
