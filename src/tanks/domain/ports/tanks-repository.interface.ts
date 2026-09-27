import { TankMeasurement } from '@prisma/client';

export interface CreateMeasurementData {
  storeCode: string;
  shiftDate: string | Date;
  shiftNo: string;
  tankId: string;
  measureType: string;
  height: number;
  volume: number;
  waterLevel?: number;
  temperature?: number;
}

export interface TanksRepository {
  createMeasurement(data: CreateMeasurementData): Promise<TankMeasurement>;
  getMeasurements(
    storeCode: string,
    date: string,
    shiftNo?: string,
  ): Promise<TankMeasurement[]>;
  getAvailableTanks(
    storeCode: string,
  ): Promise<{ tankId: string; gradeName: string }[]>;
}
