import type { EmployeeEntity } from './auth-repository.interface';

export const EMPLOYEE_REPOSITORY = 'EmployeeRepository';

export interface EmployeeRepository {
  findEmployee(
    username: string,
    storeCode?: string,
  ): Promise<EmployeeEntity | null>;
}
