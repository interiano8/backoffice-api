import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncUpDto } from './dto/sync-up.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  private validateAuth(syncKey?: string) {
    const expectedKey = process.env.SYNC_API_KEY || 'prisma-cloud-sync-key';
    if (syncKey && syncKey === expectedKey) {
      return true;
    }
    // Si no se configuró clave estricta en el entorno, permitir por defecto
    if (!process.env.SYNC_API_KEY) {
      return true;
    }
    throw new UnauthorizedException('Clave de sincronización inválida.');
  }

  @Post('up')
  async syncUp(
    @Body() dto: SyncUpDto,
    @Headers('x-sync-key') syncKey?: string,
  ) {
    this.validateAuth(syncKey);
    return this.syncService.syncUp(dto);
  }

  @Get('down/masters')
  async getMasters(
    @Query('storeCode') storeCode: string,
    @Query('sinceVersion') sinceVersion?: string,
    @Headers('x-sync-key') syncKey?: string,
  ) {
    this.validateAuth(syncKey);
    const parsedVersion = sinceVersion ? parseInt(sinceVersion, 10) : undefined;
    return this.syncService.getMasters(storeCode, parsedVersion);
  }

  @Get('down/config')
  async getStoreConfig(
    @Query('storeCode') storeCode: string,
    @Headers('x-sync-key') syncKey?: string,
  ) {
    this.validateAuth(syncKey);
    return this.syncService.getStoreConfig(storeCode);
  }

  @Post('ping')
  async ping(
    @Body() body: { storeCode: string; queueCount?: number },
    @Headers('x-sync-key') syncKey?: string,
  ) {
    this.validateAuth(syncKey);
    return this.syncService.ping(body.storeCode, body.queueCount);
  }
}
