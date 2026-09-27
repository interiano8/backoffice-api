import {
  CustomerData,
  CustomerOptions,
  CustomerListResult,
  UpdateCustomerData,
} from '../customer-repository.interface';

export interface ICustomersUseCase {
  getCustomers(
    storeCode: string,
    options: CustomerOptions,
  ): Promise<CustomerListResult>;

  getCustomer(storeCode: string, customerNo: string): Promise<CustomerData>;

  updateCustomer(
    storeCode: string,
    customerNo: string,
    data: UpdateCustomerData,
  ): Promise<{ success: boolean; message: string }>;

  toggleCustomerStatus(
    storeCode: string,
    customerNo: string,
  ): Promise<{ success: boolean; message: string; blocked: boolean }>;
}
