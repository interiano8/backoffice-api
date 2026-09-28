import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountingMappingService } from '../mapping/accounting-mapping.service';
import { JournalEntriesService } from '../entries/journal-entries.service';
import { RegisterCustomerPaymentDto } from './dto/register-customer-payment.dto';

@Injectable()
export class CustomerAccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mappingService: AccountingMappingService,
    private readonly journalEntriesService: JournalEntriesService,
  ) {}

  async registerCustomerPayment(dto: RegisterCustomerPaymentDto, userId?: string) {
    const bankAccount = await this.prisma.account.findUnique({
      where: { id: dto.bankAccountId },
    });

    if (!bankAccount) {
      throw new BadRequestException(`Cuenta bancaria con ID ${dto.bankAccountId} no existe`);
    }

    if (!bankAccount.allowsMovement) {
      throw new BadRequestException(
        `La cuenta ${bankAccount.code} - ${bankAccount.name} es de mayor y no permite movimientos`,
      );
    }

    const customerAccountId = await this.mappingService.resolveAccountId(
      'CUSTOMER_CREDIT',
      'DEFAULT',
      dto.costCenterId,
    );

    const amount = Math.round(Number(dto.amount) * 100) / 100;
    const ref = dto.referenceNumber?.trim() ? `Ref: ${dto.referenceNumber.trim()}` : '';
    const concept = `Abono de Cliente ${dto.customerNo} - ${dto.customerName} ${ref}`.trim();

    return this.journalEntriesService.createEntry(
      {
        date: dto.date,
        type: 'INCOME',
        concept,
        sourceRef: `payment:customer:${dto.customerNo}:${Date.now()}`,
        notes: dto.notes?.trim() || `Cobro registrado para cliente ${dto.customerName}`,
        lines: [
          {
            accountId: bankAccount.id,
            costCenterId: dto.costCenterId,
            debit: amount,
            credit: 0,
            description: `Depósito/Abono bancario ${ref}`.trim(),
          },
          {
            accountId: customerAccountId,
            costCenterId: dto.costCenterId,
            debit: 0,
            credit: amount,
            description: `Crédito a cuenta de cliente ${dto.customerName}`,
          },
        ],
      },
      userId,
    );
  }
}
