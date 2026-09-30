export interface CustomerData {
  customerNo: string;
  customerName: string;
  rtn: string;
  billingType: number;
  billingTypeLabel: string;
  blocked: boolean;
  address?: string;
  phone?: string;
  email?: string;
}

export interface CustomerOptions {
  search?: string;
  billingType?: string;
  page: number;
  limit: number;
}

export interface CustomerListResult {
  data: CustomerData[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateCustomerData {
  customerName?: string;
  rtn?: string;
}

export interface CustomerRepository {
  getCustomers(
    storeCode: string,
    options: CustomerOptions,
  ): Promise<CustomerListResult>;
  getCustomer(
    storeCode: string,
    customerNo: string,
  ): Promise<CustomerData | null>;
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
    },
  ): Promise<{ success: boolean; message: string; customerNo: string }>;
  toggleCustomerStatus(
    storeCode: string,
    customerNo: string,
  ): Promise<{ success: boolean; message: string; blocked: boolean }>;
}
