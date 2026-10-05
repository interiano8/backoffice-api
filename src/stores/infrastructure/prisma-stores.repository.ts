import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'pg';
import { PrismaService } from '../../prisma/prisma.service';
import {
  StoresRepository,
  StoreEntity,
} from '../domain/ports/stores-repository.interface';

@Injectable()
export class PrismaStoresRepository implements StoresRepository {
  private readonly logger = new Logger(PrismaStoresRepository.name);

  constructor(private prisma: PrismaService) {}

  private sanitizeStore(store: any): StoreEntity {
    const { dbPassword, ...rest } = store;
    return {
      ...rest,
      hasDbPassword: Boolean(dbPassword && String(dbPassword).trim().length > 0),
    } as unknown as StoreEntity;
  }

  async findAll(): Promise<StoreEntity[]> {
    const stores = await this.prisma.boStore.findMany({
      orderBy: { code: 'asc' },
    });
    return stores.map((s) => this.sanitizeStore(s));
  }

  async findAllBasic(): Promise<Partial<StoreEntity>[]> {
    return this.prisma.boStore.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        titulo: true,
        RTN: true,
        address: true,
        logoUrl: true,
        isActive: true,
        apiUrl: true,
        lanUrl: true,
        moduleCustomers: true,
        moduleAccounting: true,
        printCreditInvoices: true,
        SyncMinutes: true,
        PresentationMinutes: true,
        validarSaldoCredito: true,
      },
      orderBy: { code: 'asc' },
    }) as unknown as Partial<StoreEntity>[];
  }

  async findOne(id: string): Promise<StoreEntity | null> {
    const store = await this.prisma.boStore.findUnique({
      where: { id },
    });
    return store ? this.sanitizeStore(store) : null;
  }

  async findByCode(code: string): Promise<StoreEntity | null> {
    const store = await this.prisma.boStore.findUnique({
      where: { code },
    });
    return store ? this.sanitizeStore(store) : null;
  }

  async create(data: any): Promise<StoreEntity> {
    const createData = { ...data };
    delete createData.hasDbPassword;
    const store = await this.prisma.boStore.create({ data: createData });
    return this.sanitizeStore(store);
  }

  async update(id: string, data: Partial<StoreEntity>): Promise<StoreEntity> {
    const updateData: any = { ...data };
    if (
      updateData.dbPassword === undefined ||
      updateData.dbPassword === null ||
      (typeof updateData.dbPassword === 'string' && updateData.dbPassword.trim() === '')
    ) {
      delete updateData.dbPassword;
    }
    delete updateData.hasDbPassword;
    updateData.configVersion = { increment: 1 };
    updateData.configUpdatedAt = new Date();

    const store = await this.prisma.boStore.update({
      where: { id },
      data: updateData,
    });
    return this.sanitizeStore(store);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.boStore.delete({ where: { id } });
  }

  async testConnection(config: any): Promise<{ success: boolean; message?: string; error?: string }> {
    const client = new Client({
      host: config.ip || '127.0.0.1',
      port: Number(config.dbPort) || 5432,
      database: config.dbName || 'prisma',
      user: config.dbUser || 'postgres',
      password: config.dbPassword ? String(config.dbPassword) : undefined,
      ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      const res = await client.query('SELECT 1 as ok, current_database() as db_name, version() as pg_version');
      await client.end();
      return {
        success: true,
        message: `Conexión exitosa a PostgreSQL en ${config.ip}:${config.dbPort || 5432}/${config.dbName || 'prisma'}`,
      };
    } catch (err: any) {
      this.logger.error(`Connection test failed: ${err.message}`);
      return {
        success: false,
        error: err.message || 'Error de conexión a PostgreSQL',
      };
    }
  }
}
