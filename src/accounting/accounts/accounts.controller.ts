import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Controller('accounting/accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async listAccounts(
    @Query('type') type?: string,
    @Query('allowsMovement') allowsMovement?: string,
    @Query('search') search?: string,
  ) {
    const allowMov =
      allowsMovement === 'true' ? true : allowsMovement === 'false' ? false : undefined;
    return this.accountsService.listAccounts({ type, allowsMovement: allowMov, search });
  }

  @Get(':id')
  async getAccountById(@Param('id') id: string) {
    return this.accountsService.getAccountById(id);
  }

  @Post()
  async createAccount(@Body() dto: CreateAccountDto) {
    return this.accountsService.createAccount(dto);
  }

  @Put(':id')
  async updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.updateAccount(id, dto);
  }

  @Delete(':id')
  async deleteAccount(@Param('id') id: string) {
    return this.accountsService.deleteAccount(id);
  }
}
