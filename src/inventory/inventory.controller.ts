import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Controller(['inventory', 'api/inventory'])
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('network/:productCode')
  async getNetworkInventory(@Param('productCode') productCode: string) {
    return this.inventoryService.getNetworkInventory(productCode);
  }

  @Get(':storeCode/:productCode')
  async getStoreInventory(
    @Param('storeCode') storeCode: string,
    @Param('productCode') productCode: string,
  ) {
    return this.inventoryService.getStoreInventory(storeCode, productCode);
  }

  @Post('adjust')
  @HttpCode(HttpStatus.OK)
  async adjustStock(@Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(
      dto.storeCode,
      dto.productCode,
      dto.quantityDelta,
      dto.productName,
      dto.minStock,
    );
  }
}
