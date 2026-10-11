import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PromotionsService } from './promotions.service';
import {
  CreatePromotionDto,
  EvaluatePromotionsDto,
} from './dto/promotion.dto';

@Controller(['promotions', 'api/promotions'])
@UseGuards(JwtAuthGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPromotion(@Body() dto: CreatePromotionDto) {
    return this.promotionsService.createPromotion(dto);
  }

  @Get()
  async listPromotions(
    @Query('storeCode') storeCode?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.promotionsService.listPromotions(
      storeCode,
      activeOnly === 'true',
    );
  }

  @Get(':id')
  async getPromotionById(@Param('id') id: string) {
    return this.promotionsService.getPromotionById(id);
  }

  @Patch(':id/toggle')
  async togglePromotion(@Param('id') id: string) {
    return this.promotionsService.togglePromotion(id);
  }

  @Delete(':id')
  async deletePromotion(@Param('id') id: string) {
    return this.promotionsService.deletePromotion(id);
  }

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  async evaluateCart(@Body() dto: EvaluatePromotionsDto) {
    return this.promotionsService.evaluateCart(dto);
  }
}
