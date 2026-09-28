import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AccountingMappingService } from './accounting-mapping.service';
import { SetMappingDto } from './dto/set-mapping.dto';

@Controller('accounting/mapping')
@UseGuards(JwtAuthGuard)
export class AccountingMappingController {
  constructor(private readonly mappingService: AccountingMappingService) {}

  @Get()
  async listMappings(
    @Query('category') category?: string,
    @Query('costCenterId') costCenterId?: string,
  ) {
    return this.mappingService.listMappings(category, costCenterId);
  }

  @Post()
  async setMapping(@Body() dto: SetMappingDto) {
    return this.mappingService.setMapping(dto);
  }

  @Delete(':id')
  async deleteMapping(@Param('id') id: string) {
    return this.mappingService.deleteMapping(id);
  }
}
