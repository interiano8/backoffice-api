import { Injectable, Inject } from '@nestjs/common';
import { TankMeasurement } from '@prisma/client';
import { ITanksUseCase } from '../../domain/ports/in/tanks.use-case.port';
import type { TanksRepository } from '../../domain/ports/tanks-repository.interface';
import { TANKS_REPOSITORY } from '../../tanks.tokens';

@Injectable()
export class TanksUseCase implements ITanksUseCase {
  constructor(
    @Inject(TANKS_REPOSITORY)
    private readonly tanksRepo: TanksRepository,
  ) {}

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
    return this.tanksRepo.createMeasurement(data);
  }

  async getMeasurements(
    storeCode: string,
    date: string,
    shiftNo?: string,
  ): Promise<TankMeasurement[]> {
    return this.tanksRepo.getMeasurements(storeCode, date, shiftNo);
  }

  async getAvailableTanks(
    storeCode: string,
  ): Promise<{ tankId: string; gradeName: string }[]> {
    return this.tanksRepo.getAvailableTanks(storeCode);
  }
}
