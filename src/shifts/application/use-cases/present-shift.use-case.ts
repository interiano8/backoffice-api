import { Injectable, Inject, Logger } from '@nestjs/common';
import { IPresentShiftUseCase } from '../../domain/ports/in/present-shift.use-case.port';
import type {
  PresentationRepository,
  PresentationResult,
} from '../../domain/ports/presentation-repository.interface';
import type { IAuditUseCase } from '../../../audit/domain/ports/in/audit.use-case.port';
import { AUDIT_USE_CASE } from '../../../audit/audit.tokens';

@Injectable()
export class PresentShiftUseCase implements IPresentShiftUseCase {
  private readonly logger = new Logger(PresentShiftUseCase.name);

  constructor(
    @Inject('PresentationRepository')
    private readonly presentationRepo: PresentationRepository,
    @Inject(AUDIT_USE_CASE)
    private readonly auditUseCase: IAuditUseCase,
  ) {}

  async getExpectedShiftPresentation(
    storeCode: string,
    shiftDate: string,
    shiftNo: string,
    employeeName: string,
  ): Promise<PresentationResult> {
    return this.presentationRepo.getExpectedShiftPresentation(
      storeCode,
      shiftDate,
      shiftNo,
      employeeName,
    );
  }

  async saveShiftPresentation(
    storeCode: string,
    data: any,
  ): Promise<PresentationResult> {
    const result = await this.presentationRepo.saveShiftPresentation(
      storeCode,
      data,
    );
    await this.auditUseCase.record({
      action: 'PRESENTATION_SAVED',
      entity: 'Shift',
      entityId: data.shiftNo,
      storeCode,
      metadata: JSON.stringify({
        shiftDate: data.shiftDate,
        employeeName: data.employeeName,
      }),
    });
    return result;
  }

  async printShiftReport(
    storeCode: string,
    shiftDate: string,
    shiftNo: string,
    employeeName: string,
    printedBy: string,
    details: any,
  ): Promise<PresentationResult> {
    return this.presentationRepo.printShiftReport(
      storeCode,
      shiftDate,
      shiftNo,
      employeeName,
      printedBy,
      details,
    );
  }
}
