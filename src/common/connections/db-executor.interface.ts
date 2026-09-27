export interface QueryResult {
  recordset: any[];
  rowsAffected: number[];
}

export interface DbExecutor {
  query(sql: string): Promise<QueryResult>;
  queryParams(sql: string, params?: Record<string, any>): Promise<QueryResult>;
  execute(procedure: string): Promise<QueryResult>;
  close(): Promise<void>;
}

export interface DbConnectionFactory {
  getTpvConnection(storeCode: string): Promise<DbExecutor>;
  getFusionConnection(storeCode: string): Promise<DbExecutor>;
}
