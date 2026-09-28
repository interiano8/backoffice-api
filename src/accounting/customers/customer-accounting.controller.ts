import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CustomerAccountingService } from './customer-accounting.service';
import { RegisterCustomerPaymentDto } from './dto/register-customer-payment.dto';

@Controller('accounting/customer-payments')
@UseGuards(JwtAuthGuard)
export class CustomerAccountingController {
  constructor(private readonly customerAccountingService: CustomerAccountingService) {}

  @Post()
  async registerPayment(@Body() dto: RegisterCustomerPaymentDto, @Request() req: any) {
    const userId = req.user?.username || req.user?.sub || 'system';
    return this.customerAccountingService.registerCustomerPayment(dto, userId);
  }
}
