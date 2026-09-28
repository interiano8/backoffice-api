import { Test, TestingModule } from '@nestjs/testing';
import { CustomerAccountingService } from './customer-accounting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountingMappingService } from '../mapping/accounting-mapping.service';
import { JournalEntriesService } from '../entries/journal-entries.service';

describe('CustomerAccountingService', () => {
  let service: CustomerAccountingService;
  let prisma: any;
  let mappingService: any;
  let journalEntriesService: any;

  beforeEach(async () => {
    prisma = {
      account: {
        findUnique: jest.fn(),
      },
    };

    mappingService = {
      resolveAccountId: jest.fn().mockResolvedValue('acc-clientes-comerciales'),
    };

    journalEntriesService = {
      createEntry: jest.fn().mockResolvedValue({ id: 'entry-payment', status: 'DRAFT' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerAccountingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountingMappingService, useValue: mappingService },
        { provide: JournalEntriesService, useValue: journalEntriesService },
      ],
    }).compile();

    service = module.get<CustomerAccountingService>(CustomerAccountingService);
  });

  it('debe generar una póliza de ingreso (INCOME) en DRAFT para el abono del cliente', async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 'acc-banco',
      code: '1.1.01.03',
      name: 'Bancos HNL',
      allowsMovement: true,
    });

    const res = await service.registerCustomerPayment(
      {
        customerNo: 'CL-001',
        customerName: 'Transportes Rápidos',
        amount: 50000,
        date: '2026-09-28',
        bankAccountId: 'acc-banco',
        referenceNumber: 'TR-9988',
      },
      'cajero1',
    );

    expect(res.id).toBe('entry-payment');
    expect(journalEntriesService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INCOME',
        concept: expect.stringContaining('Transportes Rápidos'),
        lines: [
          expect.objectContaining({ accountId: 'acc-banco', debit: 50000, credit: 0 }),
          expect.objectContaining({ accountId: 'acc-clientes-comerciales', debit: 0, credit: 50000 }),
        ],
      }),
      'cajero1',
    );
  });
});
