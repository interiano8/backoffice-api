import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  BadRequestException,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TANKS_USE_CASE } from './tanks.tokens';
import type { ITanksUseCase } from './domain/ports/in/tanks.use-case.port';

@Controller('tanks')
@UseGuards(JwtAuthGuard)
export class TanksController {
  constructor(
    @Inject(TANKS_USE_CASE)
    private readonly tanksUseCase: ITanksUseCase,
  ) {}

  @Get('available')
  getAvailableTanks(@Headers('x-store-code') storeCode: string) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.tanksUseCase.getAvailableTanks(storeCode);
  }

  @Post('measurements')
  createMeasurement(
    @Headers('x-store-code') storeCode: string,
    @Body() data: any,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.tanksUseCase.createMeasurement({ ...data, storeCode });
  }

  @Get('measurements')
  getMeasurements(
    @Headers('x-store-code') storeCode: string,
    @Query('date') date: string,
    @Query('shiftNo') shiftNo?: string,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.tanksUseCase.getMeasurements(storeCode, date, shiftNo);
  }
}
