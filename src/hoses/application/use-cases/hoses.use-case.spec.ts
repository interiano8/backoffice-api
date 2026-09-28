import { HosesUseCase } from './hoses.use-case';
import type { HoseRepository, HoseEntity } from '../../domain/ports/hose-repository.interface';
import { ValidationException } from '../../../common/domain/exceptions/domain.exception';

describe('HosesUseCase', () => {
  let useCase: HosesUseCase;
  let mockRepo: jest.Mocked<HoseRepository>;

  const mockHose: HoseEntity = {
    id: 'h-1',
    storeCode: 'STORE01',
    pumpId: 1,
    hoseId: 1,
    gradeName: 'Super',
    unitPrice: 30.5,
    active: true,
  };

  beforeEach(() => {
    mockRepo = {
      findByStore: jest.fn().mockResolvedValue([mockHose]),
      updatePrice: jest.fn().mockResolvedValue({ ...mockHose, unitPrice: 31.0 }),
      create: jest.fn().mockResolvedValue(mockHose),
      update: jest.fn().mockResolvedValue({ ...mockHose, gradeName: 'Diesel' }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new HosesUseCase(mockRepo);
  });

  it('should find hoses by store code', async () => {
    const result = await useCase.findByStore('STORE01');
    expect(mockRepo.findByStore).toHaveBeenCalledWith('STORE01');
    expect(result).toHaveLength(1);
    expect(result[0].gradeName).toBe('Super');
  });

  it('should throw ValidationException if storeCode is missing', async () => {
    await expect(useCase.findByStore('')).rejects.toThrow(ValidationException);
  });

  it('should update hose price', async () => {
    const result = await useCase.updatePrice('h-1', 31.0);
    expect(mockRepo.updatePrice).toHaveBeenCalledWith('h-1', 31.0);
    expect(result.unitPrice).toBe(31.0);
  });

  it('should throw ValidationException if price is negative', async () => {
    await expect(useCase.updatePrice('h-1', -5)).rejects.toThrow(ValidationException);
  });

  it('should create a new hose', async () => {
    const data = {
      storeCode: 'STORE01',
      pumpId: 1,
      hoseId: 2,
      gradeName: 'Diesel',
      unitPrice: 28.5,
    };
    const result = await useCase.create(data);
    expect(mockRepo.create).toHaveBeenCalledWith(data);
    expect(result).toBeDefined();
  });

  it('should throw ValidationException when creating without required fields', async () => {
    await expect(useCase.create({ storeCode: '', pumpId: 1, hoseId: 1, gradeName: 'Super' })).rejects.toThrow(ValidationException);
    await expect(useCase.create({ storeCode: 'STORE01', pumpId: 0, hoseId: 1, gradeName: 'Super' })).rejects.toThrow(ValidationException);
    await expect(useCase.create({ storeCode: 'STORE01', pumpId: 1, hoseId: 0, gradeName: 'Super' })).rejects.toThrow(ValidationException);
    await expect(useCase.create({ storeCode: 'STORE01', pumpId: 1, hoseId: 1, gradeName: '' })).rejects.toThrow(ValidationException);
  });

  it('should delete a hose', async () => {
    await expect(useCase.delete('h-1')).resolves.toBeUndefined();
    expect(mockRepo.delete).toHaveBeenCalledWith('h-1');
  });
});
