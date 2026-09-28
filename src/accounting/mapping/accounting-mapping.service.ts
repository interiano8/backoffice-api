import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SetMappingDto } from './dto/set-mapping.dto';

@Injectable()
export class AccountingMappingService {
  constructor(private readonly prisma: PrismaService) {}

  async listMappings(category?: string, costCenterId?: string) {
    const where: any = {};
    if (category) where.category = category;
    if (costCenterId) where.costCenterId = costCenterId;

    return this.prisma.accountingMapping.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sourceIdentifier: 'asc' }],
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async setMapping(dto: SetMappingDto) {
    // Validar que la cuenta exista y acepte movimientos
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account) {
      throw new NotFoundException(`Cuenta contable con ID ${dto.accountId} no encontrada`);
    }
    if (!account.allowsMovement) {
      throw new BadRequestException(
        `La cuenta ${account.code} - ${account.name} es de mayor y no puede ser asignada a una regla de mapeo`,
      );
    }

    const costCenterId = dto.costCenterId || null;

    const existing = await this.prisma.accountingMapping.findFirst({
      where: {
        category: dto.category,
        sourceIdentifier: dto.sourceIdentifier,
        costCenterId,
      },
    });

    if (existing) {
      return this.prisma.accountingMapping.update({
        where: { id: existing.id },
        data: { accountId: dto.accountId },
        include: { account: true, costCenter: true },
      });
    }

    return this.prisma.accountingMapping.create({
      data: {
        category: dto.category,
        sourceIdentifier: dto.sourceIdentifier,
        accountId: dto.accountId,
        costCenterId,
      },
      include: { account: true, costCenter: true },
    });
  }

  async deleteMapping(id: string) {
    const m = await this.prisma.accountingMapping.findUnique({ where: { id } });
    if (!m) {
      throw new NotFoundException(`Regla de mapeo con ID ${id} no encontrada`);
    }
    return this.prisma.accountingMapping.delete({ where: { id } });
  }

  async resolveAccountId(category: string, sourceIdentifier: string, costCenterId?: string): Promise<string> {
    // 1. Buscar regla específica para el centro de costo
    if (costCenterId) {
      const specific = await this.prisma.accountingMapping.findFirst({
        where: {
          category,
          sourceIdentifier,
          costCenterId,
        },
      });
      if (specific) return specific.accountId;
    }

    // 2. Buscar regla global (costCenterId = null)
    const globalRule = await this.prisma.accountingMapping.findFirst({
      where: {
        category,
        sourceIdentifier,
        costCenterId: null,
      },
    });
    if (globalRule) return globalRule.accountId;

    // 3. Fallback a regla DEFAULT de la categoría
    const defaultRule = await this.prisma.accountingMapping.findFirst({
      where: {
        category,
        sourceIdentifier: 'DEFAULT',
        costCenterId: null,
      },
    });
    if (defaultRule) return defaultRule.accountId;

    throw new BadRequestException(
      `No se encontró cuenta contable mapeada para la categoría '${category}' e identificador '${sourceIdentifier}'. Por favor configúrela en Mapeo Contable.`,
    );
  }
}
