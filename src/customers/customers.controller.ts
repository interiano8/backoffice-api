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
    const targetStore = storeCode || 'GLOBAL';
    return this.customersUseCase.getCustomers(targetStore, {
      search: search || '',
      billingType,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('next-code')
  async getNextCustomerCode(
    @Headers('x-store-code') storeCode: string,
    @Query('billingType') billingType?: string,
  ) {
    const targetStore = storeCode || 'GLOBAL';
    const type = billingType !== undefined ? parseInt(billingType, 10) : 1;
    return this.customersUseCase.getNextCustomerCode(targetStore, type);
  }

  @Get(':customerNo')
  async getCustomer(
    @Headers('x-store-code') storeCode: string,
    @Param('customerNo') customerNo: string,
  ) {
    const targetStore = storeCode || 'GLOBAL';
    return this.customersUseCase.getCustomer(targetStore, customerNo);
  }

  @Post()
  async createCustomer(
    @Headers('x-store-code') storeCode: string,
    @Body() data: any,
  ) {
    const targetStore = storeCode || 'GLOBAL';
    if (!data.customerNo || !data.customerName) {
      throw new BadRequestException('Código y nombre de cliente son requeridos');
    }
    return this.customersUseCase.createCustomer(targetStore, data);
  }

  @Patch(':customerNo')
  async updateCustomer(
    @Headers('x-store-code') storeCode: string,
    @Param('customerNo') customerNo: string,
    @Body() data: any,
  ) {
    const targetStore = storeCode || 'GLOBAL';
    return this.customersUseCase.updateCustomer(targetStore, customerNo, data);
  }

  @Patch(':customerNo/toggle-status')
  async toggleCustomerStatus(
    @Headers('x-store-code') storeCode: string,
    @Param('customerNo') customerNo: string,
  ) {
    const targetStore = storeCode || 'GLOBAL';
    return this.customersUseCase.toggleCustomerStatus(targetStore, customerNo);
  }
}
