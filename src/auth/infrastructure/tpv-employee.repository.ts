import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IConnectionFactory } from '../../common/connections/connection-factory.interface';
import type { EmployeeEntity } from '../domain/ports/auth-repository.interface';
import type { EmployeeRepository } from '../domain/ports/employee-repository.interface';

@Injectable()
export class TpvEmployeeRepository implements EmployeeRepository {
  private readonly logger = new Logger(TpvEmployeeRepository.name);

  constructor(
    @Inject('IConnectionFactory')
    private readonly connectionFactory: IConnectionFactory,
  ) {}

  async findEmployee(
    username: string,
    storeCode?: string,
  ): Promise<EmployeeEntity | null> {
    const cleanUsername = username?.trim() || '';
    if (!cleanUsername) return null;

    let pool: any | null = null;
    try {
      pool = await this.connectionFactory.getTpvConnection(storeCode || 'DEFAULT');
      return await this.tryFindInEmployee(pool, cleanUsername);
    } catch (error: any) {
      this.logger.error(`Error finding employee: ${error.message}`);
      return null;
    } finally {
      if (pool) await pool.close();
    }
  }

  private async tryFindInEmployee(
    pool: any,
    username: string,
  ): Promise<EmployeeEntity | null> {
    try {
      const result = await pool.queryParams(
        `SELECT 
          id as "Id", 
          nombre as "Nombre", 
          pin as "PIN", 
          usuario as "Usuario", 
          perfil as "Perfil", 
          esta_activo as "Is_active", 
          codigo_rfid as "Codigo_RFID", 
          hash_contrasena as "PasswordHash" 
        FROM empleados 
        WHERE TRIM(usuario) ILIKE TRIM(@username)`,
        { username },
      );
      if (result.recordset?.length > 0) {
        const emp = result.recordset[0];
        if (emp.Is_active === undefined || emp.Is_active === 1 || emp.Is_active === true) {
          emp.Perfil = emp.Perfil || 'ADMIN';
          return emp;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Employee query failed: ${err.message}`);
    }
    return null;
  }
}
