import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FiscalPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPeriods(year?: number) {
    const y = year || new Date().getFullYear();
    return this.prisma.fiscalPeriod.findMany({
      where: { year: y },
      orderBy: [{ year: 'desc' }, { month: 'asc' }],
    });
  }

  async getPeriodById(id: string) {
    const period = await this.prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period) {
      throw new NotFoundException(`Periodo fiscal con ID ${id} no encontrado`);
    }
    return period;
  }

  async getOrCreatePeriodByDate(date: Date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12

    let period = await this.prisma.fiscalPeriod.findUnique({
      where: { year_month: { year, month } },
    });

    if (!period) {
      period = await this.prisma.fiscalPeriod.create({
        data: {
          year,
          month,
          status: 'OPEN',
        },
      });
    }

    return period;
  }

  async assertPeriodOpen(date: Date) {
    const period = await this.getOrCreatePeriodByDate(date);
    if (period.status === 'CLOSED') {
      throw new BadRequestException(
        `El periodo fiscal ${period.month}/${period.year} se encuentra CERRADO. No se permiten registros ni modificaciones contables.`,
      );
    }
    return period;
  }

  async closePeriod(id: string, userId: string) {
    await this.getPeriodById(id);

    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: userId,
      },
    });
  }

  async reopenPeriod(id: string) {
    await this.getPeriodById(id);

    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: {
        status: 'OPEN',
        closedAt: null,
        closedBy: null,
      },
    });
  }
}
