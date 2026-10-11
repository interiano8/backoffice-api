import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller(['telemetry', 'api/telemetry'])
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('heartbeat')
  async recordHeartbeat(
    @Body() dto: HeartbeatDto,
    @Headers('x-sync-key') syncKey?: string,
    @Headers('authorization') authHeader?: string,
    @Req() req?: any,
  ) {
    const expectedKey = process.env.SYNC_API_KEY || 'prisma-cloud-sync-key';
    const isSyncKeyValid = syncKey && syncKey === expectedKey;
    const hasBearer = authHeader && authHeader.startsWith('Bearer ');

    if (!isSyncKeyValid && !hasBearer) {
      throw new UnauthorizedException('Clave de sincronización o token de acceso requerido.');
    }

    const clientIp = req?.ip || req?.socket?.remoteAddress;
    return this.telemetryService.recordHeartbeat(dto, clientIp);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatuses() {
    return this.telemetryService.getAllStatuses();
  }
}
