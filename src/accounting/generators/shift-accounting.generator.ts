import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountingMappingService } from '../mapping/accounting-mapping.service';
import { JournalEntriesService } from '../entries/journal-entries.service';
import { CostCentersService } from '../cost-centers/cost-centers.service';

@Injectable()
export class ShiftAccountingGenerator {
  private readonly logger = new Logger(ShiftAccountingGenerator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mappingService: AccountingMappingService,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly costCentersService: CostCentersService,
  ) {}

  async generateEntryForShift(shiftId: string, userId?: string) {
    const shift = await this.prisma.boShift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new BadRequestException(`Turno con ID ${shiftId} no encontrado`);
    }

    // 0. Verificar si el módulo contable está habilitado para la estación
    const store = await this.prisma.boStore.findUnique({
      where: { code: shift.storeCode },
      select: { moduleAccounting: true },
    });
    if (store && store.moduleAccounting === 0) {
      this.logger.log(`Generación de póliza omitida para turno ${shift.id}: módulo de contabilidad deshabilitado para tienda ${shift.storeCode}`);
      return null;
    }

    // 1. Obtener o crear Centro de Costo para la estación
    let costCenter = await this.costCentersService.getCostCenterByCode(shift.storeCode);
    if (!costCenter) {
      costCenter = await this.costCentersService.createCostCenter({
        code: shift.storeCode,
        name: `Estación ${shift.storeCode}`,
        storeCode: shift.storeCode,
      });
    }
    const costCenterId = costCenter.id;

    // 2. Consultar ventas y líneas asociadas al turno
    const sales = await this.prisma.boSaleHeader.findMany({
      where: {
        storeCode: shift.storeCode,
        shiftDate: shift.shiftDate,
        shiftNo: shift.shiftNo,
        employeeName: shift.employeeName,
      },
      include: {
        payments: true,
        lines: true,
      },
    });

    // 3. Acumular Cobros (Débitos)
    let totalCashPayments = 0;
    let totalCardPayments = 0;
    let totalCreditPayments = 0;
    let totalOtherPayments = 0;

    for (const sale of sales) {
      for (const p of sale.payments) {
        const amt = Number(p.amount) || 0;
        const code = (p.chargeMethodCode || '').toUpperCase();
        if (code === 'CASH' || code === 'EFECTIVO' || code === '1') {
          totalCashPayments += amt;
        } else if (code === 'CARD' || code === 'TARJETA' || code === '2') {
          totalCardPayments += amt;
        } else if (code === 'CREDIT' || code === 'CREDITO' || code === '3') {
          totalCreditPayments += amt;
        } else {
          totalOtherPayments += amt;
        }
      }
    }

    // Usar montos declarados en arqueo si existen
    const cashFinal = shift.cashDeclared != null ? Number(shift.cashDeclared) : totalCashPayments;
    const cardFinal = shift.cardDeclared != null ? Number(shift.cardDeclared) : totalCardPayments;
    const creditFinal = totalCreditPayments;
    const otherFinal = shift.otherDeclared != null ? Number(shift.otherDeclared) : totalOtherPayments;

    const lines: Array<{
      accountId: string;
      costCenterId?: string;
      debit: number;
      credit: number;
      description?: string;
    }> = [];

    // Débito Caja
    if (cashFinal > 0) {
      const accCash = await this.mappingService.resolveAccountId('PAYMENT_METHOD', 'CASH', costCenterId);
      lines.push({
        accountId: accCash,
        costCenterId,
        debit: Math.round(cashFinal * 100) / 100,
        credit: 0,
        description: `Efectivo declarado turno #${shift.shiftNo} (${shift.employeeName})`,
      });
    }

    // Débito Tarjetas
    if (cardFinal > 0) {
      const accCard = await this.mappingService.resolveAccountId('PAYMENT_METHOD', 'CARD', costCenterId);
      lines.push({
        accountId: accCard,
        costCenterId,
        debit: Math.round(cardFinal * 100) / 100,
        credit: 0,
        description: `Cobros con tarjeta turno #${shift.shiftNo}`,
      });
    }

    // Débito Clientes Crédito
    if (creditFinal > 0) {
      const accCredit = await this.mappingService.resolveAccountId('PAYMENT_METHOD', 'CREDIT', costCenterId);
      lines.push({
        accountId: accCredit,
        costCenterId,
        debit: Math.round(creditFinal * 100) / 100,
        credit: 0,
        description: `Ventas a crédito turno #${shift.shiftNo}`,
      });
    }

    // Faltante o Sobrante de caja
    const variance = shift.cashVariance != null ? Number(shift.cashVariance) : 0;
    if (variance < -0.01) {
      // Faltante: Débito a cuenta por cobrar empleado
      const shortageAmt = Math.round(Math.abs(variance) * 100) / 100;
      const accShortage = await this.mappingService.resolveAccountId('CASH_SHORTAGE', 'DEFAULT', costCenterId);
      lines.push({
        accountId: accShortage,
        costCenterId,
        debit: shortageAmt,
        credit: 0,
        description: `Faltante de caja empleado ${shift.employeeName}`,
      });
    } else if (variance > 0.01) {
      // Sobrante: Crédito a sobrantes por liquidar
      const surplusAmt = Math.round(variance * 100) / 100;
      const accSurplus = await this.mappingService.resolveAccountId('CASH_SURPLUS', 'DEFAULT', costCenterId);
      lines.push({
        accountId: accSurplus,
        costCenterId,
        debit: 0,
        credit: surplusAmt,
        description: `Sobrante de caja turno #${shift.shiftNo}`,
      });
    }

    // 4. Acumular Ingresos por Venta (Créditos)
    let totalSuperior = 0;
    let totalRegular = 0;
    let totalDiesel = 0;
    let totalStore = 0;

    for (const sale of sales) {
      for (const l of sale.lines) {
        const amt = Number(l.amount) || 0;
        const name = (l.productName || '').toUpperCase();
        if (name.includes('SUPERIOR')) {
          totalSuperior += amt;
        } else if (name.includes('REGULAR')) {
          totalRegular += amt;
        } else if (name.includes('DIESEL') || name.includes('DIÉSEL')) {
          totalDiesel += amt;
        } else {
          totalStore += amt;
        }
      }
    }

    // Si no hubo detalle de líneas pero hubo total de venta en cabecera
    const totalSalesHeaders = sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const sumLines = totalSuperior + totalRegular + totalDiesel + totalStore;
    if (sumLines === 0 && totalSalesHeaders > 0) {
      totalSuperior = totalSalesHeaders; // fallback a combustible
    }

    if (totalSuperior > 0) {
      const accSup = await this.mappingService.resolveAccountId('FUEL_PRODUCT', 'SUPERIOR', costCenterId);
      lines.push({
        accountId: accSup,
        costCenterId,
        debit: 0,
        credit: Math.round(totalSuperior * 100) / 100,
        description: `Ventas Gasolina Superior turno #${shift.shiftNo}`,
      });
    }

    if (totalRegular > 0) {
      const accReg = await this.mappingService.resolveAccountId('FUEL_PRODUCT', 'REGULAR', costCenterId);
      lines.push({
        accountId: accReg,
        costCenterId,
        debit: 0,
        credit: Math.round(totalRegular * 100) / 100,
        description: `Ventas Gasolina Regular turno #${shift.shiftNo}`,
      });
    }

    if (totalDiesel > 0) {
      const accDie = await this.mappingService.resolveAccountId('FUEL_PRODUCT', 'DIESEL', costCenterId);
      lines.push({
        accountId: accDie,
        costCenterId,
        debit: 0,
        credit: Math.round(totalDiesel * 100) / 100,
        description: `Ventas Diésel turno #${shift.shiftNo}`,
      });
    }

    if (totalStore > 0) {
      const accStore = await this.mappingService.resolveAccountId('STORE_PRODUCT', 'DEFAULT', costCenterId);
      lines.push({
        accountId: accStore,
        costCenterId,
        debit: 0,
        credit: Math.round(totalStore * 100) / 100,
        description: `Ventas Tienda / Misceláneos turno #${shift.shiftNo}`,
      });
    }

    // Verificar si la póliza ya existe en DRAFT
    const sourceRef = `shift:${shift.id}`;
    const existingEntry = await this.prisma.journalEntry.findFirst({
      where: { sourceRef },
    });

    const shiftDateStr = shift.shiftDate instanceof Date
      ? shift.shiftDate.toISOString().substring(0, 10)
      : String(shift.shiftDate).substring(0, 10);

    const concept = `Liquidación de Turno #${shift.shiftNo} Estación ${shift.storeCode} (${shift.employeeName})`;

    if (existingEntry) {
      if (existingEntry.status === 'POSTED') {
        this.logger.log(`Póliza para turno ${shift.id} ya se encuentra contabilizada. No se re-genera.`);
        return existingEntry;
      }

      return this.journalEntriesService.updateEntry(
        existingEntry.id,
        {
          date: shiftDateStr,
          type: 'DIARY',
          concept,
          sourceRef,
          notes: `Generado automáticamente desde auditoría de turno. Ventas totales: L. ${shift.totalSale}`,
          lines,
        },
        userId,
      );
    }

    return this.journalEntriesService.createEntry(
      {
        date: shiftDateStr,
        type: 'DIARY',
        concept,
        sourceRef,
        notes: `Generado automáticamente desde auditoría de turno. Ventas totales: L. ${shift.totalSale}`,
        lines,
      },
      userId,
    );
  }
}
