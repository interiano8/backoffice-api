export interface EmployeeEntity {
  Id: number;
  Usuario: string;
  PasswordHash: string;
  Nombre: string;
  Perfil?: string;
  Is_active?: number;
  PIN?: string | number;
  Codigo_RFID?: string;
}

export interface AuthRepository {
  findEmployee(
    username: string,
    storeCode?: string,
  ): Promise<EmployeeEntity | null>;
  findStoreByCode(
    storeCode: string,
  ): Promise<{ id: string; code: string; ip: string } | null>;
  findStoreById(
    storeId: string,
  ): Promise<{ id: string; code: string; ip: string } | null>;
}
