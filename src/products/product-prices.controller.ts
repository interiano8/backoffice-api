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
import { ProductPricesService } from './product-prices.service';
import { CreateProductPriceDto, UpdateProductPriceDto } from './dto/product-price.dto';

@Controller(['product-prices', 'api/product-prices'])
@UseGuards(JwtAuthGuard)
export class ProductPricesController {
  constructor(private readonly productPricesService: ProductPricesService) {}

  @Get()
  async listPrices(
    @Query('productId') productId?: string,
    @Query('storeCode') storeCode?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.productPricesService.listPrices({
      productId,
      storeCode,
      activeOnly: activeOnly === 'true',
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPrice(@Body() dto: CreateProductPriceDto) {
    return this.productPricesService.createPrice(dto);
  }

  @Patch(':id')
  async updatePrice(
    @Param('id') id: string,
    @Body() dto: UpdateProductPriceDto,
  ) {
    return this.productPricesService.updatePrice(id, dto);
  }

  @Patch(':id/toggle')
  async togglePrice(@Param('id') id: string) {
    return this.productPricesService.togglePrice(id);
  }
}
