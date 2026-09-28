import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IHosesUseCase } from '../../domain/ports/in/hoses.use-case.port';
import type { HoseRepository, HoseEntity, CreateHoseData } from '../../domain/ports/hose-repository.interface';
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

  async create(data: CreateHoseData): Promise<HoseEntity> {
    if (!data.storeCode) {
      throw new ValidationException('El código de tienda es requerido.');
    }
    if (!data.pumpId || data.pumpId <= 0) {
      throw new ValidationException('El número de bomba debe ser mayor a 0.');
    }
    if (!data.hoseId || data.hoseId <= 0) {
      throw new ValidationException('El número de manguera debe ser mayor a 0.');
    }
    if (!data.gradeName || !data.gradeName.trim()) {
      throw new ValidationException('El nombre del producto/combustible es requerido.');
    }
    if (data.unitPrice !== undefined && data.unitPrice < 0) {
      throw new ValidationException('El precio unitario no puede ser negativo.');
    }
    return this.hoseRepo.create(data);
  }

  async update(id: string, data: Partial<CreateHoseData>): Promise<HoseEntity> {
    if (!id) {
      throw new ValidationException('El ID de la manguera es requerido.');
    }
    if (data.unitPrice !== undefined && data.unitPrice < 0) {
      throw new ValidationException('El precio unitario no puede ser negativo.');
    }
    return this.hoseRepo.update(id, data);
  }

  async delete(id: string): Promise<void> {
    if (!id) {
      throw new ValidationException('El ID de la manguera es requerido.');
    }
    return this.hoseRepo.delete(id);
  }
}
