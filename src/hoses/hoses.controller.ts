import {
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
  Body,
  Headers,
  UseGuards,
  Inject,
} from '@nestjs/common';
import type { IHosesUseCase } from './domain/ports/in/hoses.use-case.port';
import { HOSES_USE_CASE } from './hoses.tokens';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.guard';

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

  @Post()
  create(@Body() body: any, @Headers('x-store-code') headerStoreCode?: string) {
    const storeCode = body.storeCode || headerStoreCode;
    return this.hosesUseCase.create({ ...body, storeCode });
  }

  @Patch(':id/price')
  updatePrice(@Param('id') id: string, @Body() body: { unitPrice: number }) {
    return this.hosesUseCase.updatePrice(id, body.unitPrice);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.hosesUseCase.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.hosesUseCase.delete(id);
  }
}
