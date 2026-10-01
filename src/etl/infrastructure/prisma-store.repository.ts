import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { StoreRepository } from '../domain/ports/store-repository.interface';

@Injectable()
export class PrismaStoreRepository implements StoreRepository {
  constructor(private prisma: PrismaService) {}

  async findByCode(code: string) {
    const store = await this.prisma.boStore.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        ip: true,
        name: true,
        apiUrl: true,
        lanUrl: true,
        ipFusion: true,
        urlControlador: true,
      },
    });
    return store
      ? {
          id: store.id,
          code: store.code,
          ip: store.ip,
          name: store.name,
          apiUrl: store.apiUrl || undefined,
          lanUrl: store.lanUrl || undefined,
        }
      : null;
  }
}
