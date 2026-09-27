import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Headers,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  LIST_SHIFTS_USE_CASE,
  GET_SHIFT_DETAILS_USE_CASE,
  PRESENT_SHIFT_USE_CASE,
  FUSION_SHIFTS_USE_CASE,
} from './shifts.tokens';
import type { IListShiftsUseCase } from './domain/ports/in/list-shifts.use-case.port';
import type { IGetShiftDetailsUseCase } from './domain/ports/in/get-shift-details.use-case.port';
import type { IPresentShiftUseCase } from './domain/ports/in/present-shift.use-case.port';
import type { IFusionShiftsUseCase } from './domain/ports/in/fusion-shifts.use-case.port';

@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(
    @Inject(LIST_SHIFTS_USE_CASE)
    private readonly listShiftsUseCase: IListShiftsUseCase,
    @Inject(GET_SHIFT_DETAILS_USE_CASE)
    private readonly getShiftDetailsUseCase: IGetShiftDetailsUseCase,
    @Inject(PRESENT_SHIFT_USE_CASE)
    private readonly presentShiftUseCase: IPresentShiftUseCase,
    @Inject(FUSION_SHIFTS_USE_CASE)
    private readonly fusionShiftsUseCase: IFusionShiftsUseCase,
  ) {}

  // Rutas específicas PRIMERO (antes de las parametrizadas)
  @Get('dates')
  getDates(@Headers('x-store-code') storeCode: string) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    return this.listShiftsUseCase.getUniqueDates(storeCode);
  }

  @Get('available-dates')
  getAvailableDates(
    @Headers('x-store-code') storeCode: string,
    @Query('limit') limit?: string,
  ) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    const limitNum = limit ? parseInt(limit, 10) : 150;
    return this.fusionShiftsUseCase.getAvailableDates(storeCode, limitNum);
  }

  @Get('by-date/:date')
  getShiftsByDate(
    @Headers('x-store-code') storeCode: string,
    @Param('date') date: string,
  ) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    return this.fusionShiftsUseCase.getShiftsByDate(storeCode, date);
  }

  @Get('fusion-details')
  getFusionDetails(
    @Headers('x-store-code') storeCode: string,
    @Query('fsShiftIds') fsShiftIds: string,
  ) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    return this.fusionShiftsUseCase.getFusionShiftDetails(
      storeCode,
      fsShiftIds,
    );
  }

  @Get('unified-payments')
  getUnifiedPayments(
    @Headers('x-store-code') storeCode: string,
    @Query('fsShiftIds') fsShiftIds: string,
  ) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    return this.fusionShiftsUseCase.getUnifiedPayments(storeCode, fsShiftIds);
  }

  @Get('unified-products')
  getUnifiedProducts(
    @Headers('x-store-code') storeCode: string,
    @Query('fsShiftIds') fsShiftIds: string,
  ) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    return this.fusionShiftsUseCase.getUnifiedProducts(storeCode, fsShiftIds);
  }

  // Rutas genéricas/parametrizadas DESPUÉS
  @Get()
  findAll(
    @Query('date') date: string,
    @Query('status') status: string,
    @Headers('x-store-code') storeCode: string,
  ) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    return this.listShiftsUseCase.findAll(storeCode, date, status);
  }

  @Get(':date/:shiftNo')
  getShiftDetails(
    @Headers('x-store-code') storeCode: string,
    @Param('date') date: string,
    @Param('shiftNo') shiftNo: string,
    @Query('attendantName') attendantName: string,
  ) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    return this.getShiftDetailsUseCase.getShiftDetails(
      storeCode,
      date,
      shiftNo,
      attendantName,
    );
  }

  @Post('print-report')
  printReport(@Headers('x-store-code') storeCode: string, @Body() body: any) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    const { shiftDate, shiftNo, employeeName, printedBy, details } = body;
    return this.presentShiftUseCase.printShiftReport(
      storeCode,
      shiftDate,
      shiftNo,
      employeeName,
      printedBy,
      details,
    );
  }

  @Post('presentation-expected')
  getExpectedShiftPresentation(
    @Headers('x-store-code') storeCode: string,
    @Body() body: any,
  ) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    const { shiftDate, shiftNo, employeeName } = body;
    return this.presentShiftUseCase.getExpectedShiftPresentation(
      storeCode,
      shiftDate,
      shiftNo,
      employeeName,
    );
  }

  @Post('presentation')
  saveShiftPresentation(
    @Headers('x-store-code') storeCode: string,
    @Body() body: any,
  ) {
    if (!storeCode)
      throw new BadRequestException('Store Code header is required');
    return this.presentShiftUseCase.saveShiftPresentation(storeCode, body);
  }

  @Patch(':id/audit')
  auditShift(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.fusionShiftsUseCase.auditShift(id, body);
  }
}
