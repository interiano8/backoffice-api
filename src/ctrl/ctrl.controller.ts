import {
  Controller,
  Get,
  Query,
  Headers,
  BadRequestException,
  Param,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CTRL_USE_CASE } from './ctrl.tokens';
import type { ICtrlUseCase } from './domain/ports/in/ctrl.use-case.port';

@Controller('ctrl')
@UseGuards(JwtAuthGuard)
export class CtrlController {
  constructor(
    @Inject(CTRL_USE_CASE)
    private readonly ctrlUseCase: ICtrlUseCase,
  ) {}

  @Get('sales')
  async getRecentSales(
    @Headers('x-store-code') storeCode: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('shiftId') shiftId?: string,
    @Query('posNumber') posNumber?: string,
    @Query('pumpNumber') pumpNumber?: string,
    @Query('saleId') saleId?: string,
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
    @Query('limit') limit?: string,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.ctrlUseCase.getRecentSales(storeCode, {
      startDate,
      endDate,
      shiftId,
      posNumber,
      pumpNumber,
      saleId,
      minAmount,
      maxAmount,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('validation/:shiftId')
  async getShiftValidation(
    @Headers('x-store-code') storeCode: string,
    @Param('shiftId') shiftId: string,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.ctrlUseCase.getShiftValidation(storeCode, shiftId);
  }
}
