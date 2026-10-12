import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UnitsOfMeasureService } from './units-of-measure.service';
import {
  CreateUnitOfMeasureDto,
  UpdateUnitOfMeasureDto,
} from './dto/unit-of-measure.dto';

@Controller(['units-of-measure', 'api/units-of-measure'])
@UseGuards(JwtAuthGuard)
export class UnitsOfMeasureController {
  constructor(private readonly unitsService: UnitsOfMeasureService) {}

  @Get()
  async listUnits(@Query('activeOnly') activeOnly?: string) {
    return this.unitsService.listUnits(activeOnly === 'true');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUnit(@Body() dto: CreateUnitOfMeasureDto) {
    return this.unitsService.createUnit(dto);
  }

  @Patch(':id')
  async updateUnit(
    @Param('id') id: string,
    @Body() dto: UpdateUnitOfMeasureDto,
  ) {
    return this.unitsService.updateUnit(id, dto);
  }

  @Patch(':id/toggle')
  async toggleUnit(@Param('id') id: string) {
    return this.unitsService.toggleUnit(id);
  }
}
