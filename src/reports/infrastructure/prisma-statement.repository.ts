import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { StatementRepository } from '../domain/ports/statement-repository.interface';

interface CustomerStatementRow {
  customerNo: string;
  docNo: string;
  docType: number;
  date: Date;
  amount: number;
  billingType: number;
  customerName: string;
  rtn: string;
  productDetails: string;
  fleetInfo: string;
}

@Injectable()
export class PrismaStatementRepository implements StatementRepository {
  private readonly logger = new Logger(PrismaStatementRepository.name);

  constructor(private prisma: PrismaService) {}

  async getActiveCustomers(
    startDate: string,
    endDate: string,
    storeCode?: string,
  ) {
    const customers: any[] = await this.prisma.$queryRaw`
      SELECT H.[Customer No_] as customerNo, H.[VAT Reg_ No_] as rtn, H.[Cust_ Name] as customerName,
        SUM(CASE WHEN H.[POS Sales Doc_ Type] = 2 AND H.[Amount] > 0 THEN H.[Amount] ELSE 0 END) as totalCredit,
        SUM(CASE WHEN H.[POS Sales Doc_ Type] = 3 AND H.[Billing Type] = 0 THEN ABS(H.[Amount]) ELSE 0 END) as totalNC
      FROM TPV.dbo.[POS Sales Header] H
      INNER JOIN TPV.dbo.[POS Transaction Log] L ON H.[POS Transaction ID] = L.[POS Transaction ID]
      WHERE CAST(L.[Shift Date] AS DATE) BETWEEN ${startDate} AND ${endDate}
        AND H.[Customer No_] IS NOT NULL AND H.[Customer No_] <> '' AND H.[Customer No_] <> '9'
        AND ((H.[POS Sales Doc_ Type] = 2) OR (H.[POS Sales Doc_ Type] = 3 AND H.[Billing Type] = 0))
      GROUP BY H.[Customer No_], H.[VAT Reg_ No_], H.[Cust_ Name]
      HAVING SUM(ABS(H.[Amount])) > 0
    `;
    return customers.map((c: any) => ({
      ...c,
      totalCredit: Number(c.totalCredit || 0),
      totalNC: Number(c.totalNC || 0),
    }));
  }

  async getStoreUnitMappings(storeCode?: string) {
    const mappings: Record<string, string> = {};
    if (!storeCode) return mappings;
    try {
      const hoses = await this.prisma.boHose.findMany({ where: { storeCode } });
      hoses.forEach((h) => {
        if (h.gradeName) mappings[h.gradeName] = h.unitOfMeasure || 'LT';
        if (h.genericCode) mappings[h.genericCode] = h.unitOfMeasure || 'LT';
      });
    } catch (error: any) {
      this.logger.error('Error fetching unit mappings:', error);
    }
    return mappings;
  }

  async getCustomerStatementRaw(
    startDate: string,
    endDate: string,
    customerNo: string,
    storeCode?: string,
  ) {
    return this.prisma.$queryRaw<CustomerStatementRow[]>`
      SELECT H.[Customer No_] as customerNo, H.[POS Sales Doc_ No_] as docNo,
        H.[POS Sales Doc_ Type] as docType, CAST(L.[Shift Date] AS DATE) as date,
        H.[Amount] as amount, H.[Billing Type] as billingType,
        H.[Cust_ Name] as customerName, H.[VAT Reg_ No_] as rtn,
        (SELECT STRING_AGG(CONCAT(ISNULL(L2.[Description], 'Prod'), ' (',
          CAST(CAST(L2.[Quantity] AS DECIMAL(18,6)) AS VARCHAR(100)), ' * ',
          CAST(CAST(L2.[Unit Price Incl_ VAT] AS DECIMAL(18,2)) AS VARCHAR(100)), ') = ',
          CAST(CAST((L2.[Quantity] * L2.[Unit Price Incl_ VAT]) AS DECIMAL(18,2)) AS VARCHAR(100)),
          CASE WHEN ISNULL(L2.[Line Discount Amount], 0) > 0 THEN CONCAT(' - ',
            CAST(CAST(L2.[Line Discount Amount] AS DECIMAL(18,2)) AS VARCHAR(100))) ELSE '' END,
          ' = ',
          CAST(CAST((L2.[Quantity] * L2.[Unit Price Incl_ VAT] - ISNULL(L2.[Line Discount Amount], 0)) AS DECIMAL(18,2)) AS VARCHAR(100)))
          , ' | ')
         FROM TPV.dbo.[vw_POS_Sales_Line] L2
         WHERE L2.[POS Sales Doc_ No_] = H.[POS Sales Doc_ No_]) as productDetails,
        CONCAT(ISNULL(H.[Placa], ''), ' | ', ISNULL(H.[Chofer], ''), ' | ',
          ISNULL(CAST(H.[KM] AS VARCHAR), '0'), ' | ', ISNULL(H.[Orden], '')) as fleetInfo
      FROM TPV.dbo.[POS Sales Header] H
      INNER JOIN TPV.dbo.[POS Transaction Log] L ON H.[POS Transaction ID] = L.[POS Transaction ID]
      WHERE H.[Customer No_] = ${customerNo}
        AND CAST(L.[Shift Date] AS DATE) BETWEEN ${startDate} AND ${endDate}
        AND ((H.[POS Sales Doc_ Type] = 2) OR (H.[POS Sales Doc_ Type] = 3 AND H.[Billing Type] = 0))
      ORDER BY H.[Sale Date Time] ASC
    `;
  }

  async getAllStatementsRaw(startDate: string, endDate: string) {
    return this.prisma.$queryRaw<CustomerStatementRow[]>`
      SELECT H.[Customer No_] as customerNo, H.[POS Sales Doc_ No_] as docNo,
        H.[POS Sales Doc_ Type] as docType, CAST(L.[Shift Date] AS DATE) as date,
        H.[Amount] as amount, H.[Billing Type] as billingType,
        H.[Cust_ Name] as customerName, H.[VAT Reg_ No_] as rtn,
        (SELECT STRING_AGG(CONCAT(ISNULL(L2.[Description], 'Prod'), ' (',
          CAST(CAST(L2.[Quantity] AS DECIMAL(18,6)) AS VARCHAR(100)), ' * ',
          CAST(CAST(L2.[Unit Price Incl_ VAT] AS DECIMAL(18,2)) AS VARCHAR(100)), ') = ',
          CAST(CAST((L2.[Quantity] * L2.[Unit Price Incl_ VAT]) AS DECIMAL(18,2)) AS VARCHAR(100)),
          CASE WHEN ISNULL(L2.[Line Discount Amount], 0) > 0 THEN CONCAT(' - ',
            CAST(CAST(L2.[Line Discount Amount] AS DECIMAL(18,2)) AS VARCHAR(100))) ELSE '' END,
          ' = ',
          CAST(CAST((L2.[Quantity] * L2.[Unit Price Incl_ VAT] - ISNULL(L2.[Line Discount Amount], 0)) AS DECIMAL(18,2)) AS VARCHAR(100)))
          , ' | ')
         FROM TPV.dbo.[vw_POS_Sales_Line] L2
         WHERE L2.[POS Sales Doc_ No_] = H.[POS Sales Doc_ No_]) as productDetails,
        CONCAT(ISNULL(H.[Placa], ''), ' | ', ISNULL(H.[Chofer], ''), ' | ',
          ISNULL(CAST(H.[KM] AS VARCHAR), '0'), ' | ', ISNULL(H.[Orden], '')) as fleetInfo
      FROM TPV.dbo.[POS Sales Header] H
      INNER JOIN TPV.dbo.[POS Transaction Log] L ON H.[POS Transaction ID] = L.[POS Transaction ID]
      WHERE CAST(L.[Shift Date] AS DATE) BETWEEN ${startDate} AND ${endDate}
        AND ((H.[POS Sales Doc_ Type] = 2) OR (H.[POS Sales Doc_ Type] = 3 AND H.[Billing Type] = 0))
      ORDER BY H.[Customer No_] ASC, H.[Sale Date Time] ASC
    `;
  }

  async getStoreShowDetails(storeCode: string): Promise<boolean> {
    try {
      const store = await this.prisma.boStore.findUnique({
        where: { code: storeCode },
      });
      return store ? (store as any).showDetailsInStatement !== false : true;
    } catch {
      return true;
    }
  }

  processStatements(
    statements: any[],
    showDetails: boolean = true,
    unitMappings: Record<string, string> = {},
  ) {
    let runningBalance = 0;
    return statements.map((s: any) => {
      let charge = 0,
        payment = 0;
      if (s.docType === 2 || s.docType === 7) charge = Number(s.amount);
      else if (s.docType === 3) payment = Math.abs(Number(s.amount));
      runningBalance += charge - payment;

      let enrichedDetails = s.productDetails;
      if (enrichedDetails && enrichedDetails !== '-') {
        enrichedDetails = enrichedDetails
          .split(' | ')
          .map((part: string) =>
            part.replace(
              /^([^(]+)\s\(([\d.]+)\s\*\s([\d.]+)\)/,
              (_m: string, desc: string, qty: string, price: string) => {
                const unit = unitMappings[desc.trim()] || 'LT';
                return `${desc} (${qty} ${unit} * ${price})`;
              },
            ),
          )
          .join(' | ');
      }

      return {
        ...s,
        charge,
        payment,
        balance: runningBalance,
        productDetails: enrichedDetails,
        fleetInfo: s.fleetInfo,
      };
    });
  }
}
