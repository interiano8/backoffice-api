import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payment-methods')
@UseGuards(JwtAuthGuard)
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  findAllPaymentMethods() {
    return this.paymentMethodsService.findAllPaymentMethods();
  }

  @Get('exchange-rates')
  findAllExchangeRates() {
    return this.paymentMethodsService.findAllExchangeRates();
  }

  @Get(':code')
  findOnePaymentMethod(@Param('code') code: string) {
    return this.paymentMethodsService.findOnePaymentMethod(code);
  }

  @Post()
  createPaymentMethod(@Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.createPaymentMethod(dto);
  }

  @Put(':code')
  updatePaymentMethod(
    @Param('code') code: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.paymentMethodsService.updatePaymentMethod(code, dto);
  }

  @Delete(':code')
  deletePaymentMethod(@Param('code') code: string) {
    return this.paymentMethodsService.deletePaymentMethod(code);
  }

  @Post(':code/assign-stores')
  assignStores(
    @Param('code') code: string,
    @Body('storeCodes') storeCodes: string[],
  ) {
    return this.paymentMethodsService.assignStoresToPaymentMethod(
      code,
      storeCodes || [],
    );
  }

  // ===== EXCHANGE RATES ENDPOINTS =====

  @Post('exchange-rates')
  createExchangeRate(@Body() dto: CreateExchangeRateDto) {
    return this.paymentMethodsService.createExchangeRate(dto);
  }

  @Put('exchange-rates/:id')
  updateExchangeRate(
    @Param('id') id: string,
    @Body() dto: Partial<CreateExchangeRateDto>,
  ) {
    return this.paymentMethodsService.updateExchangeRate(id, dto);
  }

  @Delete('exchange-rates/:id')
  deleteExchangeRate(@Param('id') id: string) {
    return this.paymentMethodsService.deleteExchangeRate(id);
  }
}
