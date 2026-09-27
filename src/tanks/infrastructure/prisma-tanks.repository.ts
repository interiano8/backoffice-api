import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TankMeasurement } from '@prisma/client';
import type { TanksRepository } from '../domain/ports/tanks-repository.interface';

@Injectable()
export class PrismaTanksRepository implements TanksRepository {
  constructor(private prisma: PrismaService) {}

  async createMeasurement(data: {
    storeCode: string;
    shiftDate: string | Date;
    shiftNo: string;
    tankId: string;
    measureType: string;
    height: number;
    volume: number;
    waterLevel?: number;
    temperature?: number;
  }): Promise<TankMeasurement> {
    return this.prisma.tankMeasurement.create({
      data: {
        storeCode: data.storeCode,
        shiftDate: new Date(data.shiftDate),
        shiftNo: data.shiftNo,
        tankId: data.tankId,
        measureType: data.measureType,
        height: data.height,
        volume: data.volume,
        waterLevel: data.waterLevel,
        temperature: data.temperature,
      },
    });
  }

  async getMeasurements(
    storeCode: string,
    date: string,
    shiftNo?: string,
  ): Promise<TankMeasurement[]> {
    const where: any = { storeCode, shiftDate: new Date(date) };
    if (shiftNo) where.shiftNo = shiftNo;
    return this.prisma.tankMeasurement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAvailableTanks(
    storeCode: string,
  ): Promise<{ tankId: string; gradeName: string }[]> {
    const tanks = await this.prisma.boHose.findMany({
      where: { storeCode, active: true, tankId: { not: null } },
      select: { tankId: true, gradeName: true },
      distinct: ['tankId'],
    });
    return tanks
      .filter((t) => t.tankId !== null)
      .map((t) => ({
        tankId: t.tankId as string,
        gradeName: t.gradeName || 'Desconocido',
      }));
  }
}
