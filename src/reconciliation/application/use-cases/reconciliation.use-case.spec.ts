import { ReconciliationUseCase } from './reconciliation.use-case';
import type { ReconciliationRepository, ReconciliationEntity } from '../../domain/ports/reconciliation-repository.interface';
import { EntityNotFoundException, ValidationException } from '../../../common/domain/exceptions/domain.exception';

describe('ReconciliationUseCase', () => {
  let useCase: ReconciliationUseCase;
  let mockRepo: jest.Mocked<ReconciliationRepository>;

  const mockItem: ReconciliationEntity = {
    id: 'r-1',
    type: 'PUMP',
    shiftNo: '1',
    shiftDate: new Date('2026-08-31'),
    attendantName: 'Juan Perez',
    pumpId: '1',
    status: 'COMPLETED',
    difference: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn().mockResolvedValue(mockItem),
      findAll: jest.fn().mockResolvedValue([mockItem]),
      findOne: jest.fn().mockResolvedValue(mockItem),
    };
    useCase = new ReconciliationUseCase(mockRepo);
  });

  it('should create reconciliation', async () => {
    const result = await useCase.createReconciliation({ type: 'PUMP' });
    expect(mockRepo.create).toHaveBeenCalledWith({ type: 'PUMP' });
    expect(result).toEqual(mockItem);
  });

  it('should throw ValidationException on empty data', async () => {
    await expect(useCase.createReconciliation(null)).rejects.toThrow(ValidationException);
  });

  it('should get all reconciliations', async () => {
    const result = await useCase.getAll('STORE01');
    expect(mockRepo.findAll).toHaveBeenCalledWith('STORE01');
    expect(result).toHaveLength(1);
  });

  it('should get reconciliation by id and throw if not found', async () => {
    mockRepo.findOne.mockResolvedValueOnce(null);
    await expect(useCase.getById('non-existent')).rejects.toThrow(EntityNotFoundException);
  });
});
