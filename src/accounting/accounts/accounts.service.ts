import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(filters?: { type?: string; allowsMovement?: boolean; search?: string }) {
    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.allowsMovement !== undefined) {
      where.allowsMovement = filters.allowsMovement;
    }

    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.account.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        children: {
          select: { id: true, code: true, name: true, allowsMovement: true },
          orderBy: { code: 'asc' },
        },
      },
    });
  }

  async getAccountById(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        parent: true,
        children: { orderBy: { code: 'asc' } },
      },
    });

    if (!account) {
      throw new NotFoundException(`Cuenta con ID ${id} no encontrada`);
    }

    return account;
  }

  async createAccount(dto: CreateAccountDto) {
    const existing = await this.prisma.account.findUnique({
      where: { code: dto.code.trim() },
    });

    if (existing) {
      throw new BadRequestException(`Ya existe una cuenta con el código ${dto.code}`);
    }

    let parentId = dto.parentId || null;
    let expectedLevel = dto.level;

    if (parentId) {
      const parent = await this.prisma.account.findUnique({ where: { id: parentId } });
      if (!parent) {
        throw new BadRequestException(`Cuenta padre con ID ${parentId} no encontrada`);
      }
      if (!dto.code.startsWith(parent.code)) {
        throw new BadRequestException(
          `El código ${dto.code} debe iniciar con el prefijo del padre ${parent.code}`,
        );
      }
      expectedLevel = parent.level + 1;
    }

    return this.prisma.account.create({
      data: {
        code: dto.code.trim(),
        name: dto.name.trim(),
        type: dto.type,
        nature: dto.nature,
        level: expectedLevel,
        parentId,
        allowsMovement: dto.allowsMovement ?? (expectedLevel >= 4),
        isActive: true,
      },
    });
  }

  async updateAccount(id: string, dto: UpdateAccountDto) {
    await this.getAccountById(id);

    return this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.allowsMovement !== undefined && { allowsMovement: dto.allowsMovement }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteAccount(id: string) {
    const account = await this.getAccountById(id);

    // Verificar si tiene subcuentas hijas
    const childrenCount = await this.prisma.account.count({
      where: { parentId: id },
    });
    if (childrenCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar la cuenta ${account.code} porque contiene ${childrenCount} subcuentas hijas`,
      );
    }

    // Verificar si tiene movimientos contables registrados
    const linesCount = await this.prisma.journalEntryLine.count({
      where: { accountId: id },
    });
    if (linesCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar la cuenta ${account.code} porque tiene ${linesCount} movimientos contables registrados. Desactívela en su lugar.`,
      );
    }

    // Eliminar mapeos asociados si existen
    await this.prisma.accountingMapping.deleteMany({
      where: { accountId: id },
    });

    return this.prisma.account.delete({
      where: { id },
    });
  }
}
