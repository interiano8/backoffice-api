import type { DbExecutor } from './db-executor.interface';

export interface IConnectionFactory {
  getTpvConnection(storeCode: string): Promise<DbExecutor>;
  getFusionConnection(storeCode: string): Promise<DbExecutor>;
}
