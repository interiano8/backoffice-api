import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';

@Controller('accounting/cost-centers')
@UseGuards(JwtAuthGuard)
export class CostCentersController {
  constructor(private readonly costCentersService: CostCentersService) {}

  @Get()
  async listCostCenters(@Query('activeOnly') activeOnly?: string) {
    return this.costCentersService.listCostCenters(activeOnly === 'true');
  }

  @Get(':id')
  async getCostCenterById(@Param('id') id: string) {
    return this.costCentersService.getCostCenterById(id);
  }

  @Post()
  async createCostCenter(@Body() dto: CreateCostCenterDto) {
    return this.costCentersService.createCostCenter(dto);
  }

  @Put(':id')
  async updateCostCenter(@Param('id') id: string, @Body() dto: UpdateCostCenterDto) {
    return this.costCentersService.updateCostCenter(id, dto);
  }

  @Delete(':id')
  async deleteCostCenter(@Param('id') id: string) {
    return this.costCentersService.deleteCostCenter(id);
  }
}
