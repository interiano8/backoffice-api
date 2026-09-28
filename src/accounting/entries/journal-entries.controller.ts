import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JournalEntriesService } from './journal-entries.service';
import { ShiftAccountingGenerator } from '../generators/shift-accounting.generator';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';

@Controller('accounting/entries')
@UseGuards(JwtAuthGuard)
export class JournalEntriesController {
  constructor(
    private readonly journalEntriesService: JournalEntriesService,
    private readonly shiftAccountingGenerator: ShiftAccountingGenerator,
  ) {}

  @Get()
  async listEntries(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('costCenterId') costCenterId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.journalEntriesService.listEntries({
      status,
      type,
      startDate,
      endDate,
      costCenterId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async getEntryById(@Param('id') id: string) {
    return this.journalEntriesService.getEntryById(id);
  }

  @Post()
  async createEntry(@Body() dto: CreateJournalEntryDto, @Request() req: any) {
    const userId = req.user?.username || req.user?.sub || 'system';
    return this.journalEntriesService.createEntry(dto, userId);
  }

  @Put(':id')
  async updateEntry(
    @Param('id') id: string,
    @Body() dto: CreateJournalEntryDto,
    @Request() req: any,
  ) {
    const userId = req.user?.username || req.user?.sub || 'system';
    return this.journalEntriesService.updateEntry(id, dto, userId);
  }

  @Post(':id/approve')
  async approveEntry(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.username || req.user?.sub || 'contador';
    return this.journalEntriesService.approveEntry(id, userId);
  }

  @Post(':id/void')
  async voidEntry(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const userId = req.user?.username || req.user?.sub || 'contador';
    return this.journalEntriesService.voidEntry(id, reason, userId);
  }

  @Post('generate-shift/:shiftId')
  async generateFromShift(@Param('shiftId') shiftId: string, @Request() req: any) {
    const userId = req.user?.username || req.user?.sub || 'system';
    return this.shiftAccountingGenerator.generateEntryForShift(shiftId, userId);
  }
}
