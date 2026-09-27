import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  FusionRepository,
  FusionShiftRecord,
  FusionSaleRecord,
  FusionHoseRecord,
} from '../domain/ports/fusion-repository.interface';
import type { PaymentMethodEntity } from '../domain/shift.entity';

@Injectable()
export class PrismaFusionRepository implements FusionRepository {
  constructor(private prisma: PrismaService) {}

  async findShiftsByReconcilerIds(storeCode: string, ids: string[]) {
    return this.prisma.boShift.findMany({
      where: { storeCode, reconcilerShiftId: { in: ids } },
      select: {
        reconcilerShiftId: true,
        shiftNo: true,
        shiftDate: true,
        employeeName: true,
        isPresented: true,
        presentationDetails: true,
      },
    }) as unknown as FusionShiftRecord[];
  }

  async findPaymentMethodsByCriteria(
    storeCode: string,
    criteria: { shiftDate?: Date; shiftNo?: string }[],
  ) {
    return this.prisma.boPaymentMethod.findMany({
      where: { storeCode, OR: criteria },
    }) as unknown as PaymentMethodEntity[];
  }

  async findSalesByCriteria(
    storeCode: string,
    criteria: { shiftDate?: Date; shiftNo?: string }[],
  ) {
    return this.prisma.boSale.findMany({
      where: { storeCode, OR: criteria },
      select: {
        productName: true,
        amount: true,
        volume: true,
        shiftNo: true,
        shiftDate: true,
        reconcilerShiftId: true,
      },
    }) as unknown as FusionSaleRecord[];
  }

  async findHosesByStore(storeCode: string) {
    return this.prisma.boHose.findMany({
      where: { storeCode },
    }) as unknown as FusionHoseRecord[];
  }

  async findShiftsByCriteria(
    storeCode: string,
    criteria: { shiftDate?: Date; shiftNo?: string }[],
  ) {
    return this.prisma.boShift.findMany({
      where: { storeCode, OR: criteria },
      select: {
        reconcilerShiftId: true,
        shiftNo: true,
        shiftDate: true,
        employeeName: true,
        isPresented: true,
        presentationDetails: true,
      },
    }) as unknown as FusionShiftRecord[];
  }
}
