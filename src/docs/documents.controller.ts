import {
  Controller,
  Get,
  Query,
  Headers,
  BadRequestException,
  Patch,
  Param,
  Body,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DOCS_USE_CASE } from './documents.tokens';
import type { IDocsUseCase } from './domain/ports/in/docs.use-case.port';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    @Inject(DOCS_USE_CASE)
    private readonly docsUseCase: IDocsUseCase,
  ) {}

  @Get()
  async getRecentDocuments(
    @Headers('x-store-code') storeCode: string,
    @Query('search') search?: string,
    @Query('docType') docType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('shiftId') shiftId?: string,
    @Query('staff') staff?: string,
    @Query('docNo') docNo?: string,
    @Query('customerName') customerName?: string,
    @Query('posTerminal') posTerminal?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.docsUseCase.getRecentDocuments(storeCode, {
      search,
      docType,
      startDate,
      endDate,
      shiftId,
      staff,
      docNo,
      customerName,
      posTerminal,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('leal')
  async getLealDocuments(
    @Headers('x-store-code') storeCode: string,
    @Query('startShiftDate') startShiftDate?: string,
    @Query('endShiftDate') endShiftDate?: string,
    @Query('lealType') lealType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    if (!startShiftDate || !endShiftDate) {
      throw new BadRequestException('startShiftDate and endShiftDate are required');
    }
    return this.docsUseCase.getLealDocuments(storeCode, {
      startShiftDate,
      endShiftDate,
      lealType: lealType !== undefined && lealType !== '' ? lealType : undefined,
      page: page || '1',
      limit: limit || '50',
    });
  }

  @Get('customers')
  async getCustomers(
    @Headers('x-store-code') storeCode: string,
    @Query('search') search: string,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.docsUseCase.getCustomers(storeCode, search || '');
  }

  @SkipThrottle()
  @Get('charge-methods')
  async getChargeMethods(@Headers('x-store-code') storeCode: string) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.docsUseCase.getChargeMethods(storeCode);
  }

  @SkipThrottle()
  @Get('pos-codes')
  async getPosCodes(@Headers('x-store-code') storeCode: string) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.docsUseCase.getPosCodes(storeCode);
  }

  @SkipThrottle()
  @Get('users')
  async getUsers(@Headers('x-store-code') storeCode: string) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.docsUseCase.getUsers(storeCode);
  }

  @SkipThrottle()
  @Get('shift-count')
  async getShiftCount(@Headers('x-store-code') storeCode: string) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.docsUseCase.getShiftCount(storeCode);
  }

  @Patch(':transactionId')
  async updateDocument(
    @Headers('x-store-code') storeCode: string,
    @Param('transactionId') transactionId: string,
    @Body() data: any,
  ) {
    if (!storeCode) throw new BadRequestException('Store code is required');
    return this.docsUseCase.updateDocument(storeCode, transactionId, data);
  }
}
