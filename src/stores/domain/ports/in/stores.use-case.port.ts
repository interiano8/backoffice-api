export interface IStoresUseCase {
  findAll(): Promise<any[]>;
  findAllBasic(): Promise<any[]>;
  create(data: any, userId?: string): Promise<any>;
  findOne(id: string): Promise<any>;
  update(id: string, data: any, userId?: string): Promise<any>;
  remove(id: string, userId?: string): Promise<any>;
  testConnection(config: any, userId?: string): Promise<{ success: boolean; message?: string; error?: string }>;
}
