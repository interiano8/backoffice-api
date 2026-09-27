import { Module } from '@nestjs/common';
import { FusionShiftService } from './application/fusion-shift.service';
import { FusionPaymentService } from './application/fusion-payment.service';
import { FusionProductService } from './application/fusion-product.service';
import { ListShiftsUseCase } from './application/use-cases/list-shifts.use-case';
import { GetShiftDetailsUseCase } from './application/use-cases/get-shift-details.use-case';
import { PresentShiftUseCase } from './application/use-cases/present-shift.use-case';
import { FusionShiftsUseCase } from './application/use-cases/fusion-shifts.use-case';
import { PrismaShiftRepository } from './infrastructure/prisma-shift.repository';
import { PrismaFusionRepository } from './infrastructure/prisma-fusion.repository';
import { PrismaPresentationRepository } from './infrastructure/prisma-presentation.repository';
import { ShiftsController } from './shifts.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import {
  SHIFT_REPOSITORY,
  FUSION_REPOSITORY,
  PRESENTATION_REPOSITORY,
  LIST_SHIFTS_USE_CASE,
  GET_SHIFT_DETAILS_USE_CASE,
  PRESENT_SHIFT_USE_CASE,
  FUSION_SHIFTS_USE_CASE,
} from './shifts.tokens';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ShiftsController],
  providers: [
    FusionShiftService,
    FusionPaymentService,
    FusionProductService,
    { provide: SHIFT_REPOSITORY, useClass: PrismaShiftRepository },
    { provide: FUSION_REPOSITORY, useClass: PrismaFusionRepository },
    {
      provide: PRESENTATION_REPOSITORY,
      useClass: PrismaPresentationRepository,
    },
    { provide: LIST_SHIFTS_USE_CASE, useClass: ListShiftsUseCase },
    { provide: GET_SHIFT_DETAILS_USE_CASE, useClass: GetShiftDetailsUseCase },
    { provide: PRESENT_SHIFT_USE_CASE, useClass: PresentShiftUseCase },
    { provide: FUSION_SHIFTS_USE_CASE, useClass: FusionShiftsUseCase },
  ],
  exports: [
    LIST_SHIFTS_USE_CASE,
    GET_SHIFT_DETAILS_USE_CASE,
    PRESENT_SHIFT_USE_CASE,
    FUSION_SHIFTS_USE_CASE,
  ],
})
export class ShiftsModule {}
