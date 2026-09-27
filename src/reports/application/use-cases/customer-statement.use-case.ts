import { Injectable, Logger, Inject } from '@nestjs/common';
import { ICustomerStatementUseCase } from '../../domain/ports/in/customer-statement.use-case.port';
import type { StatementRepository } from '../../domain/ports/statement-repository.interface';
import { STATEMENT_REPOSITORY } from '../../reports.tokens';

@Injectable()
export class CustomerStatementUseCase implements ICustomerStatementUseCase {
  private readonly logger = new Logger(CustomerStatementUseCase.name);

  constructor(
    @Inject(STATEMENT_REPOSITORY)
    private readonly statementRepo: StatementRepository,
  ) {}

  async getActiveCustomers(
    startDate: string,
    endDate: string,
    storeCode?: string,
  ) {
    return this.statementRepo.getActiveCustomers(startDate, endDate, storeCode);
  }

  async getStoreUnitMappings(storeCode?: string) {
    return this.statementRepo.getStoreUnitMappings(storeCode);
  }

  async getCustomerStatement(
    startDate: string,
    endDate: string,
    customerNo: string,
    storeCode?: string,
  ) {
    const showDetails = storeCode
      ? await this.statementRepo.getStoreShowDetails(storeCode)
      : true;
    const statements = await this.statementRepo.getCustomerStatementRaw(
      startDate,
      endDate,
      customerNo,
      storeCode,
    );
    const unitMappings =
      await this.statementRepo.getStoreUnitMappings(storeCode);
    return this.statementRepo.processStatements(
      statements,
      showDetails,
      unitMappings,
    );
  }

  async getBulkCustomerStatements(
    startDate: string,
    endDate: string,
    storeCode?: string,
  ) {
    const customers = await this.getActiveCustomers(
      startDate,
      endDate,
      storeCode,
    );
    if (customers.length === 0) return {};

    const showDetails = storeCode
      ? await this.statementRepo.getStoreShowDetails(storeCode)
      : true;
    const customerNos = customers.map((c: any) => c.customerNo);
    const allStatementsRaw = await this.statementRepo.getAllStatementsRaw(
      startDate,
      endDate,
    );
    const allStatements = (allStatementsRaw as any[]).filter((s: any) =>
      customerNos.includes(s.customerNo),
    );
    const unitMappings =
      await this.statementRepo.getStoreUnitMappings(storeCode);

    const bulkData: Record<string, any[]> = {};
    customers.forEach((c: any) => {
      const customerTransactions = allStatements.filter(
        (s: any) => s.customerNo === c.customerNo,
      );
      bulkData[c.customerNo] = this.statementRepo.processStatements(
        customerTransactions,
        showDetails,
        unitMappings,
      );
    });
    return bulkData;
  }
}
