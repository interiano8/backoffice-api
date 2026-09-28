import { Test, TestingModule } from '@nestjs/testing';
import { AccountingMappingService } from './accounting-mapping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('AccountingMappingService', () => {
  let service: AccountingMappingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      accountingMapping: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      account: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingMappingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AccountingMappingService>(AccountingMappingService);
  });

  it('debe resolver la cuenta con regla específica de tienda si existe', async () => {
    prisma.accountingMapping.findFirst.mockResolvedValueOnce({ accountId: 'acc-store-specific' });

    const accId = await service.resolveAccountId('PAYMENT_METHOD', 'CASH', 'cc-store-1');
    expect(accId).toBe('acc-store-specific');
  });

  it('debe caer en regla global si no hay regla específica de tienda', async () => {
    prisma.accountingMapping.findFirst
      .mockResolvedValueOnce(null) // específica no existe
      .mockResolvedValueOnce({ accountId: 'acc-global' }); // global

    const accId = await service.resolveAccountId('PAYMENT_METHOD', 'CASH', 'cc-store-1');
    expect(accId).toBe('acc-global');
  });

  it('debe arrojar error si no existe ningún mapeo ni regla por defecto', async () => {
    prisma.accountingMapping.findFirst.mockResolvedValue(null);

    await expect(service.resolveAccountId('UNKNOWN', 'XYZ')).rejects.toThrow(BadRequestException);
  });
});
