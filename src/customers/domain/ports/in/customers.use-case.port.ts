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

  getNextCustomerCode(
    storeCode: string,
    billingType: number,
  ): Promise<{ customerNo: string }>;

  updateCustomer(
    storeCode: string,
    customerNo: string,
    data: UpdateCustomerData,
  ): Promise<{ success: boolean; message: string }>;

  createCustomer(
    storeCode: string,
    data: {
      customerNo: string;
      customerName: string;
      rtn?: string;
      billingType: number;
      creditLimit?: number;
      notes?: string;
    },
  ): Promise<{ success: boolean; message: string; customerNo: string; customer?: CustomerData }>;

  toggleCustomerStatus(
    storeCode: string,
    customerNo: string,
  ): Promise<{ success: boolean; message: string; blocked: boolean }>;
}
