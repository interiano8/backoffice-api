import { Test, TestingModule } from '@nestjs/testing';
import { FiscalPeriodsService } from './fiscal-periods.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('FiscalPeriodsService', () => {
  let service: FiscalPeriodsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      fiscalPeriod: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiscalPeriodsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FiscalPeriodsService>(FiscalPeriodsService);
  });

  it('debe permitir operaciones si el periodo está abierto', async () => {
    prisma.fiscalPeriod.findUnique.mockResolvedValue({
      id: 'p-1',
      year: 2026,
      month: 9,
      status: 'OPEN',
    });

    const period = await service.assertPeriodOpen(new Date('2026-09-15'));
    expect(period.status).toBe('OPEN');
  });

  it('debe bloquear operaciones si el periodo está cerrado', async () => {
    prisma.fiscalPeriod.findUnique.mockResolvedValue({
      id: 'p-1',
      year: 2026,
      month: 8,
      status: 'CLOSED',
    });

    await expect(service.assertPeriodOpen(new Date('2026-08-15'))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('debe cerrar un periodo fiscal registrando usuario y fecha', async () => {
    prisma.fiscalPeriod.findUnique.mockResolvedValue({
      id: 'p-1',
      year: 2026,
      month: 7,
      status: 'OPEN',
    });
    prisma.fiscalPeriod.update.mockResolvedValue({
      id: 'p-1',
      status: 'CLOSED',
      closedBy: 'contador1',
    });

    const res = await service.closePeriod('p-1', 'contador1');
    expect(res.status).toBe('CLOSED');
    expect(prisma.fiscalPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-1' },
        data: expect.objectContaining({ status: 'CLOSED', closedBy: 'contador1' }),
      }),
    );
  });
});
