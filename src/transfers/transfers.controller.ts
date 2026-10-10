import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import {
  CreateTransferDto,
  DispatchTransferDto,
  ReceiveTransferDto,
  CancelTransferDto,
} from './dto/create-transfer.dto';

@Controller(['transfers', 'api/transfers'])
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTransfer(@Body() dto: CreateTransferDto) {
    return this.transfersService.createTransfer(dto);
  }

  @Get()
  async getTransfers(
    @Query('storeCode') storeCode?: string,
    @Query('status') status?: string,
  ) {
    return this.transfersService.getTransfers({ storeCode, status });
  }

  @Get(':id')
  async getTransferById(@Param('id') id: string) {
    return this.transfersService.getTransferById(id);
  }

  @Patch(':id/approve')
  async approveTransfer(
    @Param('id') id: string,
    @Body('approvedBy') approvedBy?: string,
  ) {
    return this.transfersService.approveTransfer(id, approvedBy);
  }

  @Patch(':id/dispatch')
  async dispatchTransfer(
    @Param('id') id: string,
    @Body() dto: DispatchTransferDto,
  ) {
    return this.transfersService.dispatchTransfer(id, dto);
  }

  @Patch(':id/receive')
  async receiveTransfer(
    @Param('id') id: string,
    @Body() dto: ReceiveTransferDto,
  ) {
    return this.transfersService.receiveTransfer(id, dto);
  }

  @Patch(':id/cancel')
  async cancelTransfer(
    @Param('id') id: string,
    @Body() dto: CancelTransferDto,
  ) {
    return this.transfersService.cancelTransfer(id, dto);
  }
}
