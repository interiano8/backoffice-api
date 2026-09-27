import { Injectable, Logger, Inject } from '@nestjs/common';
import { ICustomersUseCase } from '../../domain/ports/in/customers.use-case.port';
import type {
  CustomerRepository,
  CustomerOptions,
  UpdateCustomerData,
} from '../../domain/ports/customer-repository.interface';
import { CUSTOMER_REPOSITORY } from '../../customers.tokens';
import { EntityNotFoundException, ValidationException } from '../../../common/domain/exceptions/domain.exception';

@Injectable()
export class CustomersUseCase implements ICustomersUseCase {
  private readonly logger = new Logger(CustomersUseCase.name);

  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: CustomerRepository,
  ) {}

  async getCustomers(storeCode: string, options: CustomerOptions) {
    try {
      return await this.customerRepo.getCustomers(storeCode, options);
    } catch (error: any) {
      this.logger.error(`Error in getCustomers: ${error.message}`);
      throw new ValidationException(`Could not fetch customers: ${error.message}`);
    }
  }

  async getCustomer(storeCode: string, customerNo: string) {
    const customer = await this.customerRepo.getCustomer(storeCode, customerNo);
    if (!customer) {
      throw new EntityNotFoundException('Customer', customerNo);
    }
    return customer;
  }

  async updateCustomer(
    storeCode: string,
    customerNo: string,
    data: UpdateCustomerData,
  ) {
    try {
      return await this.customerRepo.updateCustomer(
        storeCode,
        customerNo,
        data,
      );
    } catch (error: any) {
      this.logger.error(`Error in updateCustomer: ${error.message}`);
      throw new ValidationException(
        `Could not update customer: ${error.message}`,
      );
    }
  }

  async toggleCustomerStatus(storeCode: string, customerNo: string) {
    try {
      return await this.customerRepo.toggleCustomerStatus(
        storeCode,
        customerNo,
      );
    } catch (error: any) {
      this.logger.error(`Error in toggleCustomerStatus: ${error.message}`);
      throw new ValidationException(
        `Could not toggle customer status: ${error.message}`,
      );
    }
  }
}
