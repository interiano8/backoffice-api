import { Injectable, Logger } from '@nestjs/common';
import { IFusionShiftsUseCase } from '../../domain/ports/in/fusion-shifts.use-case.port';
import { FusionShiftService } from '../fusion-shift.service';
import { FusionPaymentService } from '../fusion-payment.service';
import { FusionProductService } from '../fusion-product.service';

@Injectable()
export class FusionShiftsUseCase implements IFusionShiftsUseCase {
  private readonly logger = new Logger(FusionShiftsUseCase.name);

  constructor(
    private readonly fusionShiftService: FusionShiftService,
    private readonly fusionPaymentService: FusionPaymentService,
    private readonly fusionProductService: FusionProductService,
  ) {}

  async getFusionShiftDetails(storeCode: string, fsShiftIds: string) {
    return this.fusionShiftService.getFusionShiftDetails(storeCode, fsShiftIds);
  }

  async getUnifiedPayments(storeCode: string, fsShiftIds: string) {
    return this.fusionPaymentService.getUnifiedPayments(storeCode, fsShiftIds);
  }

  async getUnifiedProducts(storeCode: string, fsShiftIds: string) {
    return this.fusionProductService.getUnifiedProducts(storeCode, fsShiftIds);
  }

  async getAvailableDates(storeCode: string, limit: number = 150) {
    return this.fusionShiftService.getAvailableDates(storeCode, limit);
  }

  async getShiftsByDate(storeCode: string, date: string) {
    return this.fusionShiftService.getShiftsByDate(storeCode, date);
  }

  async auditShift(id: string, auditData: any) {
    return this.fusionShiftService.auditShift(id, auditData);
  }
}
