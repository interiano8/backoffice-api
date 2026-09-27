import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ReportRepository,
  SalesDeclarationRow,
  CustomerStatementRow,
  ActiveCustomerRow,
} from '../domain/ports/report-repository.interface';

@Injectable()
export class PrismaReportRepository implements ReportRepository {
  private readonly logger = new Logger(PrismaReportRepository.name);

  constructor(private prisma: PrismaService) {}

  async getSalesDeclaration(
    startDate: string,
    endDate: string,
    type: string,
    storeCode?: string,
  ): Promise<SalesDeclarationRow[]> {
    if (!storeCode) return [];

    if (type === 'resumido') {
      return this.prisma.$queryRaw`
        SELECT CAST(TR.[Shift Date] AS DATE) as [date], H.[Line No_] as [rangeNo], 'MULTIPLE' as [pos],
          MIN(H.[POS Sales Doc_ Type]) as [docType], S.[CAI] as [cai], S.[Rango Desde] as [rangeFrom],
          S.[Rango Hasta] as [rangeTo], S.[Fecha Vence Rango] as [rangeDueDate],
          MIN(H.[POS Sales Doc_ No_]) as [desde], MAX(H.[POS Sales Doc_ No_]) as [hasta],
          COUNT(DISTINCT H.[POS Sales Doc_ No_]) as [docs],
          SUM(CASE WHEN L.[VAT _] = 0 THEN L.[Amount Including VAT] ELSE 0 END) as [exempt],
          SUM(CASE WHEN L.[VAT _] = 15 THEN (L.[Amount Including VAT] - L.[VAT_Amount]) ELSE 0 END) as [taxed15],
          SUM(CASE WHEN L.[VAT _] = 18 THEN (L.[Amount Including VAT] - L.[VAT_Amount]) ELSE 0 END) as [taxed18],
          SUM(CASE WHEN L.[VAT _] = 15 THEN L.[VAT_Amount] ELSE 0 END) as [tax15],
          SUM(CASE WHEN L.[VAT _] = 18 THEN L.[VAT_Amount] ELSE 0 END) as [tax18],
          SUM(L.[Amount Including VAT]) as [total]
        FROM TPV.dbo.[POS Sales Header] H
        INNER JOIN TPV.dbo.[POS Transaction Log] TR ON H.[POS Transaction ID] = TR.[POS Transaction ID]
        LEFT JOIN TPV.dbo.[POS Sales Line] L ON H.[POS Transaction ID] = L.[POS Transaction ID]
        LEFT JOIN TPV.dbo.[No_ Series Line] S ON H.[Line No_] = S.[Line No_] AND H.[Gas Station Code] = S.[Gas Station Code] AND H.[POS Code] = S.[POS Code]
        WHERE CAST(TR.[Shift Date] AS DATE) BETWEEN CAST(${startDate} AS DATE) AND CAST(${endDate} AS DATE)
          AND H.[Gas Station Code] = ${storeCode} AND H.[POS Sales Doc_ Type] IN (1, 2, 3)
        GROUP BY CAST(TR.[Shift Date] AS DATE), H.[Line No_], S.[CAI], S.[Rango Desde], S.[Rango Hasta], S.[Fecha Vence Rango]
        ORDER BY [date] ASC, H.[Line No_] ASC
      ` as any;
    }

    return this.prisma.$queryRaw`
      SELECT H.[Sale Date Time] as [date], H.[Line No_] as [rangeNo], H.[POS Code] as [pos],
        H.[POS Sales Doc_ Type] as [docType], S.[CAI] as [cai], S.[Rango Desde] as [rangeFrom],
        S.[Rango Hasta] as [rangeTo], S.[Fecha Vence Rango] as [rangeDueDate],
        H.[POS Sales Doc_ No_] as [docNo], 1 as [docs],
        SUM(CASE WHEN L.[VAT _] = 0 THEN L.[Amount Including VAT] ELSE 0 END) as [exempt],
        SUM(CASE WHEN L.[VAT _] = 15 THEN (L.[Amount Including VAT] - L.[VAT_Amount]) ELSE 0 END) as [taxed15],
        SUM(CASE WHEN L.[VAT _] = 18 THEN (L.[Amount Including VAT] - L.[VAT_Amount]) ELSE 0 END) as [taxed18],
        SUM(CASE WHEN L.[VAT _] = 15 THEN L.[VAT_Amount] ELSE 0 END) as [tax15],
        SUM(CASE WHEN L.[VAT _] = 18 THEN L.[VAT_Amount] ELSE 0 END) as [tax18],
        SUM(L.[Amount Including VAT]) as [total]
      FROM TPV.dbo.[POS Sales Header] H
      INNER JOIN TPV.dbo.[POS Transaction Log] TR ON H.[POS Transaction ID] = TR.[POS Transaction ID]
      LEFT JOIN TPV.dbo.[POS Sales Line] L ON H.[POS Transaction ID] = L.[POS Transaction ID]
      LEFT JOIN TPV.dbo.[No_ Series Line] S ON H.[Line No_] = S.[Line No_] AND H.[Gas Station Code] = S.[Gas Station Code] AND H.[POS Code] = S.[POS Code]
      WHERE CAST(TR.[Shift Date] AS DATE) BETWEEN CAST(${startDate} AS DATE) AND CAST(${endDate} AS DATE)
        AND H.[Gas Station Code] = ${storeCode} AND H.[POS Sales Doc_ Type] IN (1, 2, 3)
      GROUP BY TR.[Shift Date], H.[Sale Date Time], H.[POS Sales Doc_ No_], H.[Line No_], H.[POS Code], H.[POS Sales Doc_ Type], S.[CAI], S.[Rango Desde], S.[Rango Hasta], S.[Fecha Vence Rango]
      ORDER BY H.[POS Code] ASC, H.[Line No_] ASC, H.[Sale Date Time] ASC, H.[POS Sales Doc_ No_] ASC
    ` as any;
  }

  async getCustomerStatement(
    startDate: string,
    endDate: string,
    customerNo: string,
    storeCode?: string,
  ): Promise<CustomerStatementRow[]> {
    return [];
  }

  async getBulkCustomerStatements(
    startDate: string,
    endDate: string,
    storeCode?: string,
  ): Promise<Record<string, CustomerStatementRow[]>> {
    return {};
  }

  async getActiveCustomers(
    startDate: string,
    endDate: string,
    storeCode?: string,
  ): Promise<ActiveCustomerRow[]> {
    return [];
  }

  async getStoreUnitMappings(
    storeCode?: string,
  ): Promise<Record<string, string>> {
    return {};
  }
}
