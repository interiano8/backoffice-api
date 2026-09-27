import { CustomersUseCase } from './customers.use-case';
import type { CustomerRepository, CustomerData, CustomerOptions } from '../../domain/ports/customer-repository.interface';
import { EntityNotFoundException, ValidationException } from '../../../common/domain/exceptions/domain.exception';

describe('CustomersUseCase', () => {
  let useCase: CustomersUseCase;
  let mockRepo: jest.Mocked<CustomerRepository>;

  const mockCustomer: CustomerData = {
    customerNo: 'CUST-001',
    customerName: 'ACME Corp',
    rtn: '08011990123456',
    billingType: 1,
    billingTypeLabel: 'Credito',
    blocked: false,
  };

  const defaultOptions: CustomerOptions = {
    search: 'ACME',
    page: 1,
    limit: 10,
  };

  beforeEach(() => {
    mockRepo = {
      getCustomers: jest.fn().mockResolvedValue({ data: [mockCustomer], total: 1, page: 1, limit: 10 }),
      getCustomer: jest.fn().mockResolvedValue(mockCustomer),
      updateCustomer: jest.fn().mockResolvedValue({ success: true, message: 'Updated' }),
      toggleCustomerStatus: jest.fn().mockResolvedValue({ success: true, message: 'Status toggled', blocked: true }),
    };
    useCase = new CustomersUseCase(mockRepo);
  });

  it('should list customers by store code and options', async () => {
    const result = await useCase.getCustomers('STORE01', defaultOptions);
    expect(mockRepo.getCustomers).toHaveBeenCalledWith('STORE01', defaultOptions);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].customerNo).toBe('CUST-001');
  });

  it('should throw ValidationException when listing fails', async () => {
    mockRepo.getCustomers.mockRejectedValueOnce(new Error('Connection failure'));
    await expect(useCase.getCustomers('STORE01', defaultOptions)).rejects.toThrow(ValidationException);
  });

  it('should get customer by customerNo', async () => {
    const result = await useCase.getCustomer('STORE01', 'CUST-001');
    expect(mockRepo.getCustomer).toHaveBeenCalledWith('STORE01', 'CUST-001');
    expect(result).toEqual(mockCustomer);
  });

  it('should throw EntityNotFoundException when customer does not exist', async () => {
    mockRepo.getCustomer.mockResolvedValueOnce(null);
    await expect(useCase.getCustomer('STORE01', 'NONEXISTENT')).rejects.toThrow(EntityNotFoundException);
  });

  it('should update customer data', async () => {
    const updateData = { customerName: 'ACME Corp International' };
    const result = await useCase.updateCustomer('STORE01', 'CUST-001', updateData);
    expect(mockRepo.updateCustomer).toHaveBeenCalledWith('STORE01', 'CUST-001', updateData);
    expect(result.success).toBe(true);
  });

  it('should toggle customer blocked status', async () => {
    const result = await useCase.toggleCustomerStatus('STORE01', 'CUST-001');
    expect(mockRepo.toggleCustomerStatus).toHaveBeenCalledWith('STORE01', 'CUST-001');
    expect(result.blocked).toBe(true);
  });
});
