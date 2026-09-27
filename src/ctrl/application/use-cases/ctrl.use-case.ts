import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { ICtrlUseCase } from '../../domain/ports/in/ctrl.use-case.port';
import type { CtrlRepository } from '../../domain/ports/ctrl-repository.interface';
import { CTRL_REPOSITORY } from '../../ctrl.tokens';

@Injectable()
export class CtrlUseCase implements ICtrlUseCase {
  private readonly logger = new Logger(CtrlUseCase.name);

  constructor(
    @Inject(CTRL_REPOSITORY) private readonly ctrlRepo: CtrlRepository,
  ) {}

  async getRecentSales(storeCode: string, filters: any = {}) {
    try {
      return await this.ctrlRepo.getRecentSales(storeCode, filters);
    } catch (error: any) {
      this.logger.error(`Error in getRecentSales: ${error.message}`);
      throw new BadRequestException(`Could not fetch sales: ${error.message}`);
    }
  }

  async getShiftValidation(storeCode: string, shiftId: string) {
    try {
      return await this.ctrlRepo.getShiftValidation(storeCode, shiftId);
    } catch (error: any) {
      this.logger.error(`Error in getShiftValidation: ${error.message}`);
      throw new BadRequestException(
        `Could not fetch shift validation: ${error.message}`,
      );
    }
  }
}
