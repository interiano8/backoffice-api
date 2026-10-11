import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryCountService } from './inventory-count.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { UpdateThresholdDto } from './dto/update-threshold.dto';
import {
  CreateInventoryCountDto,
  UpdateInventoryCountItemsDto,
  ApplyInventoryCountDto,
  CancelInventoryCountDto,
} from './dto/inventory-count.dto';

@Controller(['inventory', 'api/inventory'])
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly inventoryCountService: InventoryCountService,
  ) {}

  @Get('network/:productCode')
  async getNetworkInventory(@Param('productCode') productCode: string) {
    return this.inventoryService.getNetworkInventory(productCode);
  }

  // Low stock alerts & replenishment
  @Get('alerts/low-stock')
  async getLowStockAlerts(@Query('storeCode') storeCode?: string) {
    return this.inventoryService.getLowStockAlerts(storeCode);
  }

  @Put('thresholds')
  async updateThresholds(@Body() dto: UpdateThresholdDto) {
    return this.inventoryService.updateThresholds(dto.storeCode, dto.items);
  }


  // Count sessions endpoints
  @Post('counts')
  @HttpCode(HttpStatus.CREATED)
  async createCountSession(@Body() dto: CreateInventoryCountDto) {
    return this.inventoryCountService.createCountSession(dto);
  }

  @Get('counts')
  async listCountSessions(
    @Query('storeCode') storeCode?: string,
    @Query('status') status?: string,
  ) {
    return this.inventoryCountService.listCountSessions(storeCode, status);
  }

  @Get('counts/:id')
  async getCountSessionById(@Param('id') id: string) {
    return this.inventoryCountService.getCountSessionById(id);
  }

  @Put('counts/:id/items')
  async updateCountItems(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryCountItemsDto,
  ) {
    return this.inventoryCountService.updateCountItems(id, dto);
  }

  @Patch('counts/:id/apply')
  async applyAdjustments(
    @Param('id') id: string,
    @Body() dto: ApplyInventoryCountDto,
  ) {
    return this.inventoryCountService.applyAdjustments(id, dto);
  }

  @Patch('counts/:id/cancel')
  async cancelCountSession(
    @Param('id') id: string,
    @Body() dto: CancelInventoryCountDto,
  ) {
    return this.inventoryCountService.cancelCountSession(id, dto);
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

