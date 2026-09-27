import { Pool, PoolClient } from "pg";
import { DbExecutor, QueryResult } from "./db-executor.interface";

export class PgExecutor implements DbExecutor {
  constructor(
    private readonly clientOrPool: Pool | PoolClient,
    private readonly isDedicatedClient: boolean = false,
  ) {}

  private transformNamedQuery(
    sql: string,
    params?: Record<string, any>,
  ): { text: string; values: any[] } {
    if (!params || Object.keys(params).length === 0) {
      return { text: sql, values: [] };
    }

    const values: any[] = [];
    const paramMap = new Map<string, number>();

    const text = sql.replace(/@([a-zA-Z0-9_]+)/g, (_match, paramName) => {
      if (!paramMap.has(paramName)) {
        values.push(params[paramName]);
        paramMap.set(paramName, values.length);
      }
      return "$" + paramMap.get(paramName);
    });

    return { text, values };
  }

  async query(sql: string): Promise<QueryResult> {
    const res = await this.clientOrPool.query(sql);
    return {
      recordset: res.rows || [],
      rowsAffected: [res.rowCount ?? 0],
    };
  }

  async queryParams(
    sql: string,
    params?: Record<string, any>,
  ): Promise<QueryResult> {
    const { text, values } = this.transformNamedQuery(sql, params);
    const res = await this.clientOrPool.query(text, values);
    return {
      recordset: res.rows || [],
      rowsAffected: [res.rowCount ?? 0],
    };
  }

  async execute(procedure: string): Promise<QueryResult> {
    const res = await this.clientOrPool.query("CALL " + procedure);
    return {
      recordset: res.rows || [],
      rowsAffected: [res.rowCount ?? 0],
    };
  }

  async close(): Promise<void> {
    if (this.isDedicatedClient && "release" in this.clientOrPool) {
      (this.clientOrPool as PoolClient).release();
    }
  }
}
