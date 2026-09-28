import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalPeriodsService } from '../fiscal-periods/fiscal-periods.service';
import { CreateJournalEntryDto, JournalEntryLineDto } from './dto/create-journal-entry.dto';

@Injectable()
export class JournalEntriesService {
  private readonly logger = new Logger(JournalEntriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscalPeriodsService: FiscalPeriodsService,
  ) {}

  async listEntries(filters?: {
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    costCenterId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.min(100, Math.max(1, filters?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    if (filters?.costCenterId) {
      where.lines = {
        some: { costCenterId: filters.costCenterId },
      };
    }

    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { concept: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { sourceRef: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({
        where,
        orderBy: [{ date: 'desc' }, { entryNumber: 'desc' }],
        skip,
        take: limit,
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true, type: true } },
              costCenter: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEntryById(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        fiscalPeriod: true,
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, type: true, nature: true } },
            costCenter: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Póliza contable con ID ${id} no encontrada`);
    }

    return entry;
  }

  private async validateAndComputeLines(lines: JournalEntryLineDto[]) {
    if (!lines || lines.length < 2) {
      throw new BadRequestException('Una póliza contable debe contener al menos dos líneas');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;

      if (debit < 0 || credit < 0) {
        throw new BadRequestException(`Línea ${i + 1}: Los montos no pueden ser negativos`);
      }

      if (debit === 0 && credit === 0) {
        throw new BadRequestException(`Línea ${i + 1}: Debe ingresar un monto en Débito o Crédito`);
      }

      if (debit > 0 && credit > 0) {
        throw new BadRequestException(`Línea ${i + 1}: No puede ingresar simultáneamente Débito y Crédito`);
      }

      // Validar cuenta
      const account = await this.prisma.account.findUnique({ where: { id: line.accountId } });
      if (!account) {
        throw new BadRequestException(`Línea ${i + 1}: Cuenta contable con ID ${line.accountId} no existe`);
      }
      if (!account.allowsMovement) {
        throw new BadRequestException(
          `Línea ${i + 1}: La cuenta ${account.code} - ${account.name} es de mayor y no permite movimientos directos`,
        );
      }

      totalDebit += debit;
      totalCredit += credit;
    }

    totalDebit = Math.round(totalDebit * 10000) / 10000;
    totalCredit = Math.round(totalCredit * 10000) / 10000;

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.0001) {
      throw new BadRequestException(
        `Póliza descuadrada: Suma de Débitos (L. ${totalDebit.toFixed(2)}) no coincide con Suma de Créditos (L. ${totalCredit.toFixed(2)}). Diferencia: L. ${diff.toFixed(2)}`,
      );
    }

    return { totalDebit, totalCredit };
  }

  async createEntry(dto: CreateJournalEntryDto, userId?: string) {
    const entryDate = new Date(dto.date);
    const fiscalPeriod = await this.fiscalPeriodsService.assertPeriodOpen(entryDate);

    const { totalDebit, totalCredit } = await this.validateAndComputeLines(dto.lines);

    return this.prisma.journalEntry.create({
      data: {
        date: entryDate,
        type: dto.type || 'DIARY',
        concept: dto.concept.trim(),
        status: 'DRAFT',
        sourceRef: dto.sourceRef?.trim() || null,
        totalDebit,
        totalCredit,
        notes: dto.notes?.trim() || null,
        fiscalPeriodId: fiscalPeriod.id,
        createdById: userId || null,
        lines: {
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            costCenterId: l.costCenterId || null,
            debit: l.debit,
            credit: l.credit,
            description: l.description?.trim() || null,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: true,
            costCenter: true,
          },
        },
      },
    });
  }

  async updateEntry(id: string, dto: CreateJournalEntryDto, userId?: string) {
    const existing = await this.getEntryById(id);

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Solo se pueden modificar pólizas en estado BORRADOR (DRAFT). Esta póliza se encuentra en estado ${existing.status}`,
      );
    }

    const entryDate = new Date(dto.date);
    const fiscalPeriod = await this.fiscalPeriodsService.assertPeriodOpen(entryDate);

    const { totalDebit, totalCredit } = await this.validateAndComputeLines(dto.lines);

    // Reemplazar líneas en transacción
    return this.prisma.$transaction(async (tx) => {
      await tx.journalEntryLine.deleteMany({ where: { entryId: id } });

      return tx.journalEntry.update({
        where: { id },
        data: {
          date: entryDate,
          type: dto.type || existing.type,
          concept: dto.concept.trim(),
          notes: dto.notes !== undefined ? dto.notes?.trim() : existing.notes,
          totalDebit,
          totalCredit,
          fiscalPeriodId: fiscalPeriod.id,
          lines: {
            create: dto.lines.map((l) => ({
              accountId: l.accountId,
              costCenterId: l.costCenterId || null,
              debit: l.debit,
              credit: l.credit,
              description: l.description?.trim() || null,
            })),
          },
        },
        include: {
          lines: {
            include: { account: true, costCenter: true },
          },
        },
      });
    });
  }

  async approveEntry(id: string, userId: string) {
    const entry = await this.getEntryById(id);

    if (entry.status === 'POSTED') {
      return entry; // ya aprobada
    }

    if (entry.status === 'VOIDED') {
      throw new BadRequestException('No se puede aprobar una póliza que fue ANULADA');
    }

    await this.fiscalPeriodsService.assertPeriodOpen(entry.date);

    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'POSTED',
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        lines: { include: { account: true, costCenter: true } },
      },
    });
  }

  async voidEntry(id: string, reason: string, userId: string) {
    const entry = await this.getEntryById(id);

    if (entry.status !== 'POSTED') {
      throw new BadRequestException('Solo se pueden anular pólizas que se encuentren CONTABILIZADAS (POSTED)');
    }

    await this.fiscalPeriodsService.assertPeriodOpen(entry.date);

    const cleanReason = reason?.trim() || 'Anulación de póliza por auditoría';

    return this.prisma.$transaction(async (tx) => {
      // 1. Crear póliza de reversión espejo en POSTED
      const reversal = await tx.journalEntry.create({
        data: {
          date: new Date(),
          type: 'REVERSAL',
          concept: `Reversión Póliza #${entry.entryNumber}: ${cleanReason}`,
          status: 'POSTED',
          sourceRef: `reversal:${entry.id}`,
          totalDebit: entry.totalCredit,
          totalCredit: entry.totalDebit,
          notes: `Generada automáticamente al anular Póliza #${entry.entryNumber}`,
          fiscalPeriodId: entry.fiscalPeriodId,
          createdById: userId,
          approvedById: userId,
          approvedAt: new Date(),
          lines: {
            create: entry.lines.map((l) => ({
              accountId: l.accountId,
              costCenterId: l.costCenterId,
              // Invertir Debe y Haber
              debit: l.credit,
              credit: l.debit,
              description: `Reversión: ${l.description || entry.concept}`,
            })),
          },
        },
      });

      // 2. Marcar póliza original como VOIDED
      const updatedOriginal = await tx.journalEntry.update({
        where: { id },
        data: {
          status: 'VOIDED',
          reversedById: userId,
          reversedAt: new Date(),
          reversalEntryId: reversal.id,
          notes: `${entry.notes || ''}\n[ANULADA]: ${cleanReason}`.trim(),
        },
      });

      return {
        original: updatedOriginal,
        reversal,
      };
    });
  }
}
