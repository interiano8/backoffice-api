import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthRepository } from '../domain/ports/auth-repository.interface';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private prisma: PrismaService) {}

  async findStoreByCode(storeCode: string) {
    const store = await this.prisma.boStore.findUnique({
      where: { code: storeCode },
    });
    return store ? { id: store.id, code: store.code, ip: store.ip } : null;
  }

  async findStoreById(storeId: string) {
    const store = await this.prisma.boStore.findUnique({
      where: { id: storeId },
    });
    return store ? { id: store.id, code: store.code, ip: store.ip } : null;
  }

  async findEmployee(_username: string, _storeCode?: string) {
    return null;
  }
}
