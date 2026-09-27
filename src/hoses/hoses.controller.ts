import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Headers,
  UseGuards,
  Inject,
} from '@nestjs/common';
import type { IHosesUseCase } from './domain/ports/in/hoses.use-case.port';
import { HOSES_USE_CASE } from './hoses.tokens';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('hoses')
export class HosesController {
  constructor(
    @Inject(HOSES_USE_CASE) private readonly hosesUseCase: IHosesUseCase,
  ) {}

  @Get()
  findByStore(@Headers('x-store-code') storeCode: string) {
    return this.hosesUseCase.findByStore(storeCode);
  }

  @Patch(':id/price')
  updatePrice(@Param('id') id: string, @Body() body: { unitPrice: number }) {
    return this.hosesUseCase.updatePrice(id, body.unitPrice);
  }
}
