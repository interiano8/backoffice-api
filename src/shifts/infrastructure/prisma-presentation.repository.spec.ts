import { PrismaPresentationRepository } from './prisma-presentation.repository';

describe('PrismaPresentationRepository', () => {
  let repo: PrismaPresentationRepository;
  let prisma: {
    boPaymentMethod: { findMany: jest.Mock };
    boShift: { findUnique: jest.Mock; update: jest.Mock };
    boStore: { findUnique: jest.Mock };
    boPrintedReport: { count: jest.Mock; create: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      boPaymentMethod: { findMany: jest.fn().mockResolvedValue([]) },
      boShift: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'shift-1' }),
      },
      boStore: { findUnique: jest.fn().mockResolvedValue(null) },
      boPrintedReport: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'print-1',
          version: 1,
          printedBy: 'admin',
          printedAt: new Date('2026-01-01T00:00:00Z'),
          stationName: 'Station 1',
        }),
      },
    };
    repo = new PrismaPresentationRepository(prisma as any);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('getExpectedShiftPresentation', () => {
    it('should return zeroed totals when there are no payment methods', async () => {
      const result = await repo.getExpectedShiftPresentation(
        'S01',
        '2026-08-31',
        '1',
        'Juan',
      );

      expect(result.success).toBe(true);
      expect(result.expected!.list).toEqual([]);
      expect(result.expected!.totals).toEqual({
        cash: 0,
        card: 0,
        other: 0,
        total: 0,
      });
      expect(prisma.boPaymentMethod.findMany).toHaveBeenCalledWith({
        where: {
          storeCode: 'S01',
          shiftNo: '1',
          employeeName: 'Juan',
          shiftDate: new Date('2026-08-31T00:00:00Z'),
          esTicket: false,
        },
      });
    });

    it('should group payment methods by type and description', async () => {
      prisma.boPaymentMethod.findMany.mockResolvedValue([
        { amount: '500', chargeMethodCode: '01', description: 'EFECTIVO' },
        { amount: '300', chargeMethodCode: '03', description: 'EFECTIVO' },
        { amount: '10', chargeMethodCode: '04', description: '   EFECTIVO   ' },
        { amount: '150.25', chargeMethodCode: '02', description: 'TARJETA DE CREDITO' },
        { amount: '25', chargeMethodCode: 'VISA', description: 'Pago con POS' },
        { amount: 40, chargeMethodCode: undefined, description: undefined },
        { amount: '75', chargeMethodCode: '01', description: 'VOUCHER' },
      ]);

      const result = await repo.getExpectedShiftPresentation(
        'S01',
        '2026-08-31T15:30:00.000Z',
        '1',
        'Juan',
      );

      expect(result.expected!.list).toEqual([
        { name: 'EFECTIVO', expected: 810, type: 'cash', declared: 0, difference: 0, raw: null },
        {
          name: 'TARJETA DE CREDITO',
          expected: 150.25,
          type: 'card',
          declared: 0,
          difference: 0,
          raw: null,
        },
        { name: 'Pago con POS', expected: 25, type: 'card', declared: 0, difference: 0, raw: null },
        { name: 'Desconocido', expected: 40, type: 'other', declared: 0, difference: 0, raw: null },
        { name: 'VOUCHER', expected: 75, type: 'cash', declared: 0, difference: 0, raw: null },
      ]);
      expect(result.expected!.totals).toEqual({
        cash: 885,
        card: 175.25,
        other: 40,
        total: 1100.25,
      });
      expect(prisma.boPaymentMethod.findMany).toHaveBeenCalledWith({
        where: {
          storeCode: 'S01',
          shiftNo: '1',
          employeeName: 'Juan',
          shiftDate: new Date('2026-08-31T00:00:00Z'),
          esTicket: false,
        },
      });
    });
  });

  describe('saveShiftPresentation', () => {
    const baseData = {
      shiftDate: '2026-08-31',
      shiftNo: '1',
      employeeName: 'Juan',
      comment: 'ok',
    };

    it('should throw when the shift does not exist', async () => {
      prisma.boShift.findUnique.mockResolvedValue(null);

      await expect(
        repo.saveShiftPresentation('S01', { ...baseData, details: [] }),
      ).rejects.toThrow('Shift not found');
      expect(prisma.boShift.update).not.toHaveBeenCalled();
    });

    it('should persist a balanced presentation when shift is not presented yet', async () => {
      const updated = { id: 'shift-1', isPresented: true, isBalanced: true };
      prisma.boShift.findUnique.mockResolvedValue({
        id: 'shift-1',
        isPresented: false,
      });
      prisma.boShift.update.mockResolvedValue(updated);

      const details = [
        { name: 'EFECTIVO', expected: 100, declared: '100', type: 'cash', raw: null },
        { name: 'EFECTIVO 2', expected: 1000, declared: '1,000', type: 'cash', raw: 'x' },
        { name: 'TARJETA', expected: 50, declared: 50, type: 'card', raw: null },
        { name: 'VOUCHER', expected: '30', declared: '30.00', type: 'other', raw: null },
      ];

      const result = await repo.saveShiftPresentation('S01', {
        ...baseData,
        details,
      });

      expect(prisma.boStore.findUnique).not.toHaveBeenCalled();
      expect(prisma.boShift.update).toHaveBeenCalledWith({
        where: { id: 'shift-1' },
        data: {
          isPresented: true,
          cashDeclared: 1100,
          cardDeclared: 50,
          otherDeclared: 30,
          isBalanced: true,
          presentationDate: expect.any(Date),
          presentationDetails: JSON.stringify([
            { name: 'EFECTIVO', expected: 100, declared: 100, difference: 0, type: 'cash', raw: null },
            { name: 'EFECTIVO 2', expected: 1000, declared: 1000, difference: 0, type: 'cash', raw: 'x' },
            { name: 'TARJETA', expected: 50, declared: 50, difference: 0, type: 'card', raw: null },
            { name: 'VOUCHER', expected: 30, declared: 30, difference: 0, type: 'other', raw: null },
          ]),
          presentationComment: 'ok',
        },
      });
      expect(result.success).toBe(true);
      expect(result.isBalanced).toBe(true);
      expect(result.declared).toEqual({ cash: 1100, card: 50, other: 30 });
      expect(result.systemTotals).toEqual({ cash: 1100, card: 50, other: 30 });
      expect(result.differences).toEqual({
        cash: 0,
        card: 0,
        other: 0,
        total: 0,
      });
      expect(result.shift).toEqual(updated);
    });

    it('should flag the presentation as unbalanced when totals differ', async () => {
      prisma.boShift.findUnique.mockResolvedValue({
        id: 'shift-1',
        isPresented: false,
      });
      prisma.boShift.update.mockResolvedValue({ id: 'shift-1', isBalanced: false });

      const details = [
        { name: 'EFECTIVO', expected: 100, declared: 200, type: 'cash' },
      ];

      const result = await repo.saveShiftPresentation('S01', {
        ...baseData,
        details,
      });

      expect(result.success).toBe(true);
      expect(result.isBalanced).toBe(false);
      expect(result.details![0]).toEqual({
        name: 'EFECTIVO',
        expected: 100,
        declared: 200,
        difference: 100,
        type: 'cash',
        raw: null,
      });
    });

    it('should refuse to edit when the presentation is locked', async () => {
      const presentedAt = new Date(Date.now() - 60 * 60 * 1000);
      prisma.boShift.findUnique.mockResolvedValue({
        id: 'shift-1',
        isPresented: true,
        presentationDate: presentedAt,
      });
      prisma.boStore.findUnique.mockResolvedValue(null);

      const result = await repo.saveShiftPresentation('S01', {
        ...baseData,
        details: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('La presentación ya no se puede editar');
      expect(prisma.boShift.update).not.toHaveBeenCalled();
      expect(prisma.boStore.findUnique).toHaveBeenCalledWith({
        where: { code: 'S01' },
        select: { PresentationMinutes: true },
      });
    });

    it('should allow editing within the lock window and apply store minutes', async () => {
      prisma.boShift.findUnique.mockResolvedValue({
        id: 'shift-1',
        isPresented: true,
        presentationDate: new Date(),
      });
      prisma.boStore.findUnique.mockResolvedValue({ PresentationMinutes: 120 });

      await repo.saveShiftPresentation('S01', {
        ...baseData,
        details: [{ name: 'EFECTIVO', expected: 10, declared: 10, type: 'cash' }],
      });

      expect(prisma.boShift.update).toHaveBeenCalled();
    });

    it('should skip the lock check when presentationDate is missing', async () => {
      prisma.boShift.findUnique.mockResolvedValue({
        id: 'shift-1',
        isPresented: true,
        presentationDate: null,
      });

      await repo.saveShiftPresentation('S01', {
        ...baseData,
        details: [{ name: 'EFECTIVO', expected: 10, declared: 10, type: 'cash' }],
      });

      expect(prisma.boStore.findUnique).not.toHaveBeenCalled();
      expect(prisma.boShift.update).toHaveBeenCalled();
    });

    it('should not lock when PresentationMinutes is zero', async () => {
      prisma.boShift.findUnique.mockResolvedValue({
        id: 'shift-1',
        isPresented: true,
        presentationDate: new Date(Date.now() - 60 * 60 * 1000),
      });
      prisma.boStore.findUnique.mockResolvedValue({ PresentationMinutes: 0 });

      const result = await repo.saveShiftPresentation('S01', {
        ...baseData,
        details: [{ name: 'EFECTIVO', expected: 10, declared: 10, type: 'cash' }],
      });

      expect(result.success).toBe(true);
      expect(prisma.boShift.update).toHaveBeenCalled();
    });

    it('should support ISO shiftDate values', async () => {
      prisma.boShift.findUnique.mockResolvedValue({
        id: 'shift-1',
        isPresented: false,
      });

      await repo.saveShiftPresentation('S01', {
        ...baseData,
        shiftDate: '2026-08-31T15:30:00.000Z',
        details: [],
      });

      expect(prisma.boShift.findUnique).toHaveBeenCalledWith({
        where: {
          source_storeCode_shiftDate_shiftNo_employeeName: {
            source: 'TPV',
            storeCode: 'S01',
            shiftDate: new Date('2026-08-31T00:00:00Z'),
            shiftNo: '1',
            employeeName: 'Juan',
          },
        },
      });
    });
  });

  describe('printShiftReport', () => {
    it('should create a printed report with a computed version', async () => {
      prisma.boPrintedReport.count.mockResolvedValue(2);
      prisma.boPrintedReport.create.mockResolvedValue({
        id: 'print-1',
        version: 3,
        printedBy: 'admin',
        printedAt: new Date('2026-01-01T00:00:00Z'),
        stationName: 'Station 1',
      });

      const details = {
        stationName: 'Station 1',
        turnoControlador: 'TC-1',
        id_contadores: 42,
      };

      const result = await repo.printShiftReport(
        'S01',
        '2026-08-31',
        '1',
        'Juan',
        'admin',
        details,
      );

      expect(prisma.boPrintedReport.count).toHaveBeenCalledWith({
        where: {
          storeCode: 'S01',
          shiftDate: new Date('2026-08-31'),
          shiftNo: '1',
          employeeName: 'Juan',
        },
      });
      expect(prisma.boPrintedReport.create).toHaveBeenCalledWith({
        data: {
          storeCode: 'S01',
          shiftDate: new Date('2026-08-31'),
          shiftNo: '1',
          employeeName: 'Juan',
          printedBy: 'admin',
          stationName: 'Station 1',
          version: 3,
          turnoControlador: 'TC-1',
          id_contadores: 42,
          dataSnapshot: JSON.stringify(details),
          printedAt: expect.any(Date),
        },
      });
      expect(result).toEqual({
        success: true,
        version: 3,
        printedBy: 'admin',
        printedAt: new Date('2026-01-01T00:00:00Z'),
        stationName: 'Station 1',
      });
    });

    it('should default the station name when it is not provided', async () => {
      const result = await repo.printShiftReport(
        'S01',
        '2026-08-31',
        '1',
        'Juan',
        'admin',
        {},
      );

      expect(prisma.boPrintedReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stationName: 'Unknown Station',
          turnoControlador: null,
          id_contadores: null,
        }),
      });
      expect(result.success).toBe(true);
    });
  });
});
