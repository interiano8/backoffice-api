import {
  Controller,
  Get,
  Post,
  Query,
  Headers,
  BadRequestException,
  Patch,
  Param,
  Body,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CUSTOMERS_USE_CASE } from './customers.tokens';
import type { ICustomersUseCase } from './domain/ports/in/customers.use-case.port';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(
    @Inject(CUSTOMERS_USE_CASE)
    private readonly customersUseCase: ICustomersUseCase,
  ) {}

  @Get()
  async getCustomers(
    @Headers('x-store-code') storeCode: string,
    @Query('search') search?: string,
    @Query('billingType') billingType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.customersUseCase.getCustomers(storeCode, {
      search: search || '',
      billingType,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get(':customerNo')
  async getCustomer(
    @Headers('x-store-code') storeCode: string,
    @Param('customerNo') customerNo: string,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.customersUseCase.getCustomer(storeCode, customerNo);
  }

  @Post()
  async createCustomer(
    @Headers('x-store-code') storeCode: string,
    @Body() data: any,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    if (!data.customerNo || !data.customerName) {
      throw new BadRequestException('Código y nombre de cliente son requeridos');
    }
    return this.customersUseCase.createCustomer(storeCode, data);
  }

  @Patch(':customerNo')
  async updateCustomer(
    @Headers('x-store-code') storeCode: string,
    @Param('customerNo') customerNo: string,
    @Body() data: any,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.customersUseCase.updateCustomer(storeCode, customerNo, data);
  }

  @Patch(':customerNo/toggle-status')
  async toggleCustomerStatus(
    @Headers('x-store-code') storeCode: string,
    @Param('customerNo') customerNo: string,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.customersUseCase.toggleCustomerStatus(storeCode, customerNo);
  }
}
