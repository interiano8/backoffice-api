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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Controller(['suppliers', 'api/suppliers'])
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  async listSuppliers(@Query('activeOnly') activeOnly?: string) {
    return this.suppliersService.listSuppliers(activeOnly === 'true');
  }

  @Get(':id')
  async getSupplierById(@Param('id') id: string) {
    return this.suppliersService.getSupplierById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.createSupplier(dto);
  }

  @Patch(':id')
  async updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.updateSupplier(id, dto);
  }

  @Patch(':id/toggle')
  async toggleSupplier(@Param('id') id: string) {
    return this.suppliersService.toggleSupplier(id);
  }
}
