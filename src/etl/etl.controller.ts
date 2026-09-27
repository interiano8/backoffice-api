import {
  Controller,
  Post,
  Get,
  Headers,
  BadRequestException,
  Body,
  UseGuards,
  Inject,
} from '@nestjs/common';
import type { IEtlUseCase } from './domain/ports/in/etl.use-case.port';
import { ETL_USE_CASE } from './etl.tokens';
import { EtlCronTask } from './infrastructure/tasks/etl-cron.task';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('etl')
@UseGuards(JwtAuthGuard)
export class EtlController {
  constructor(
    @Inject(ETL_USE_CASE) private readonly etlUseCase: IEtlUseCase,
    private readonly etlCronTask: EtlCronTask,
  ) {}

  @Get('cron-status')
  getCronStatus() {
    return this.etlCronTask.getStatus();
  }

  @Post('hose-config')
  async getHoseConfiguration(@Headers('x-store-code') storeCode: string) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    return this.etlUseCase.getHoseConfiguration(storeCode);
  }

  @Post('sync')
  async triggerSync(
    @Headers('x-store-code') storeCode: string,
    @Body() body?: { reconcilerShiftId?: string; reconcilerShiftIds?: string[] },
  ) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');

    if (body?.reconcilerShiftIds && body.reconcilerShiftIds.length > 0) {
      return this.etlUseCase.syncMultipleShifts(
        storeCode,
        body.reconcilerShiftIds,
      );
    }

    if (body?.reconcilerShiftId) {
      return this.etlUseCase.syncByReconcilerShiftId(
        storeCode,
        body.reconcilerShiftId,
      );
    }

    return this.etlUseCase.syncSales(storeCode);
  }
}
