import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { FiscalPeriodsService } from './fiscal-periods.service';

@Controller('accounting/fiscal-periods')
@UseGuards(JwtAuthGuard)
export class FiscalPeriodsController {
  constructor(private readonly fiscalPeriodsService: FiscalPeriodsService) {}

  @Get()
  async listPeriods(@Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : undefined;
    return this.fiscalPeriodsService.listPeriods(y);
  }

  @Get(':id')
  async getPeriodById(@Param('id') id: string) {
    return this.fiscalPeriodsService.getPeriodById(id);
  }

  @Post(':id/close')
  async closePeriod(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.username || req.user?.sub || 'system';
    return this.fiscalPeriodsService.closePeriod(id, userId);
  }

  @Post(':id/reopen')
  async reopenPeriod(@Param('id') id: string) {
    return this.fiscalPeriodsService.reopenPeriod(id);
  }
}
