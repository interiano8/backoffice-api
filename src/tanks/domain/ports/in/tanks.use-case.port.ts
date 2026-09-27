import { TankMeasurement } from '@prisma/client';

export interface ITanksUseCase {
  createMeasurement(data: {
    storeCode: string;
    shiftDate: string | Date;
    shiftNo: string;
    tankId: string;
    measureType: string;
    height: number;
    volume: number;
    waterLevel?: number;
    temperature?: number;
  }): Promise<TankMeasurement>;

  getMeasurements(
    storeCode: string,
    date: string,
    shiftNo?: string,
  ): Promise<TankMeasurement[]>;

  getAvailableTanks(
    storeCode: string,
  ): Promise<{ tankId: string; gradeName: string }[]>;
}
