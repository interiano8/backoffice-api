import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      account: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      journalEntryLine: {
        count: jest.fn(),
      },
      accountingMapping: {
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('debe listar cuentas ordenadas por código', async () => {
    prisma.account.findMany.mockResolvedValue([
      { id: '1', code: '1', name: 'ACTIVO' },
      { id: '2', code: '1.1', name: 'ACTIVO CORRIENTE' },
    ]);

    const result = await service.listAccounts();
    expect(result).toHaveLength(2);
    expect(prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { code: 'asc' } }),
    );
  });

  it('debe rechazar la creación si el código ya existe', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: '1', code: '1.1.01' });

    await expect(
      service.createAccount({
        code: '1.1.01',
        name: 'Caja',
        type: 'ASSET',
        nature: 'DEBIT',
        level: 3,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe validar que el código de la hija comience con el código del padre', async () => {
    prisma.account.findUnique
      .mockResolvedValueOnce(null) // código no existe
      .mockResolvedValueOnce({ id: 'p1', code: '1.1.01', level: 3 }); // parent

    await expect(
      service.createAccount({
        code: '2.1.01.01', // no empieza con 1.1.01
        name: 'Subcuenta inválida',
        type: 'ASSET',
        nature: 'DEBIT',
        level: 4,
        parentId: 'p1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe crear exitosamente una cuenta hija válida', async () => {
    prisma.account.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'p1', code: '1.1.01', level: 3 });

    prisma.account.create.mockResolvedValue({
      id: 'c1',
      code: '1.1.01.01',
      name: 'Caja General',
      level: 4,
      allowsMovement: true,
    });

    const res = await service.createAccount({
      code: '1.1.01.01',
      name: 'Caja General',
      type: 'ASSET',
      nature: 'DEBIT',
      level: 4,
      parentId: 'p1',
    });

    expect(res.id).toBe('c1');
    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: '1.1.01.01',
          level: 4,
          allowsMovement: true,
        }),
      }),
    );
  });

  it('debe impedir eliminar cuenta con subcuentas hijas', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'p1', code: '1.1' });
    prisma.account.count.mockResolvedValue(2); // tiene 2 hijas

    await expect(service.deleteAccount('p1')).rejects.toThrow(BadRequestException);
  });

  it('debe impedir eliminar cuenta con movimientos contables', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'c1', code: '1.1.01.01' });
    prisma.account.count.mockResolvedValue(0); // 0 hijas
    prisma.journalEntryLine.count.mockResolvedValue(5); // 5 movimientos

    await expect(service.deleteAccount('c1')).rejects.toThrow(BadRequestException);
  });
});
