import { AuditUseCase } from './audit.use-case';
import type { AuditRepository, AuditEntry } from '../../domain/ports/audit-repository.interface';

describe('AuditUseCase', () => {
  let useCase: AuditUseCase;
  let mockAuditRepo: jest.Mocked<AuditRepository>;

  beforeEach(() => {
    mockAuditRepo = {
      record: jest.fn().mockResolvedValue(undefined),
      findAll: jest.fn().mockResolvedValue([]),
    };
    useCase = new AuditUseCase(mockAuditRepo);
  });

  it('should record an audit entry successfully', async () => {
    const entry: AuditEntry = {
      action: 'LOGIN',
      entity: 'USER',
      storeCode: 'STORE01',
      userId: 'admin',
    };

    await useCase.record(entry);
    expect(mockAuditRepo.record).toHaveBeenCalledWith(entry);
  });

  it('should not throw when audit recording fails (silent fallback)', async () => {
    mockAuditRepo.record.mockRejectedValueOnce(new Error('DB Error'));
    const entry: AuditEntry = {
      action: 'LOGIN',
      entity: 'USER',
    };

    await expect(useCase.record(entry)).resolves.not.toThrow();
  });

  it('should retrieve audit entries with filters', async () => {
    const mockList = [{ id: '1', action: 'LOGIN', entity: 'USER', timestamp: new Date() }];
    mockAuditRepo.findAll.mockResolvedValueOnce(mockList as any);

    const result = await useCase.findAll({ entity: 'USER' });
    expect(mockAuditRepo.findAll).toHaveBeenCalledWith({ entity: 'USER' });
    expect(result).toEqual(mockList);
  });
});
