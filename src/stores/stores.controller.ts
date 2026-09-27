import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Inject,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.guard';
import { STORES_USE_CASE } from './stores.tokens';
import type { IStoresUseCase } from './domain/ports/in/stores.use-case.port';
import { StoreHealthService } from './store-health.service';

@Controller('stores')
export class StoresController {
  constructor(
    @Inject(STORES_USE_CASE)
    private readonly storesUseCase: IStoresUseCase,
    private readonly storeHealthService: StoreHealthService,
  ) {}

  @Get('public')
  findAllPublic() {
    return this.storesUseCase.findAllBasic();
  }

  @Get('basic')
  findAllBasic() {
    return this.storesUseCase.findAllBasic();
  }

  @Get('health-status')
  getHealthStatus() {
    return this.storeHealthService.checkAllStoresHealth();
  }

  @Get('health-summary')
  getHealthSummary() {
    return this.storeHealthService.getHealthSummary();
  }

  @Post(':id/ping')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async pingStore(@Param('id') id: string) {
    const store = await this.storesUseCase.findOne(id);
    if (!store) {
      return { success: false, error: 'Tienda no encontrada' };
    }
    const health = await this.storeHealthService.checkStoreHealth(store);
    return { success: health.healthStatus === 'ONLINE', data: health };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.storesUseCase.findAll();
  }

  @Post('test-connection')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  testConnection(@Body() config: any, @Request() req?: any) {
    const userId = req?.user?.username || req?.user?.userId;
    return this.storesUseCase.testConnection(config, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@Body() createStoreDto: any, @Request() req?: any) {
    const userId = req?.user?.username || req?.user?.userId;
    return this.storesUseCase.create(createStoreDto, userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.storesUseCase.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @Body() updateStoreDto: any, @Request() req?: any) {
    const userId = req?.user?.username || req?.user?.userId;
    return this.storesUseCase.update(id, updateStoreDto, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string, @Request() req?: any) {
    const userId = req?.user?.username || req?.user?.userId;
    return this.storesUseCase.remove(id, userId);
  }
}
