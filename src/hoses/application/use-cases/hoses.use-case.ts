import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IHosesUseCase } from '../../domain/ports/in/hoses.use-case.port';
import type { HoseRepository, HoseEntity } from '../../domain/ports/hose-repository.interface';
import { HOSE_REPOSITORY } from '../../hoses.tokens';
import { ValidationException } from '../../../common/domain/exceptions/domain.exception';

@Injectable()
export class HosesUseCase implements IHosesUseCase {
  private readonly logger = new Logger(HosesUseCase.name);

  constructor(
    @Inject(HOSE_REPOSITORY) private readonly hoseRepo: HoseRepository,
  ) {}

  async findByStore(storeCode: string): Promise<HoseEntity[]> {
    if (!storeCode) {
      throw new ValidationException('Store code is required.');
    }
    return this.hoseRepo.findByStore(storeCode);
  }

  async updatePrice(id: string, unitPrice: number): Promise<HoseEntity> {
    if (unitPrice < 0) {
      throw new ValidationException('Unit price cannot be negative.');
    }
    return this.hoseRepo.updatePrice(id, unitPrice);
  }
}
