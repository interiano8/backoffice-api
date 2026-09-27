import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { StoreRepository } from '../domain/ports/store-repository.interface';

@Injectable()
export class PrismaStoreRepository implements StoreRepository {
  constructor(private prisma: PrismaService) {}

  async findByCode(code: string) {
    const store = await this.prisma.boStore.findUnique({ where: { code } });
    return store
      ? { id: store.id, code: store.code, ip: store.ip, name: store.name }
      : null;
  }
}
