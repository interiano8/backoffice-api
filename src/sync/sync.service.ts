import { Injectable, Logger, BadRequestException, NotFoundException, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SyncUpDto, SyncSaleDto, SyncShiftDto } from './dto/sync-up.dto';
import type { SyncMastersResponseDto, SyncMasterUserDto, SyncMasterCustomerDto } from './dto/sync-masters.dto';
import type { IConnectionFactory } from '../common/connections/connection-factory.interface';
import { AlertConfigService } from '../alerts/alert-config.service';
import { BrevoNotificationService } from '../alerts/brevo-notification.service';
import { AlertTemplateBuilder } from '../alerts/alert-template.builder';

/** Código de la casa matriz: fuente única del catálogo central de clientes. */
const HQ_STORE_CODE = '000';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject('IConnectionFactory')
    private readonly connectionFactory?: IConnectionFactory,
    @Optional() private readonly alertConfigService?: AlertConfigService,
    @Optional() private readonly brevoService?: BrevoNotificationService,
  ) {}

  async syncUp(dto: SyncUpDto) {
    if (!dto.storeCode || dto.storeCode.trim() === '') {
      throw new BadRequestException('El código de tienda (storeCode) es obligatorio.');
    }

    const storeCode = dto.storeCode.trim();
    const source = 'TPV';
    const confirmedTransactionIds: string[] = [];

    // 1. Procesar ventas en lotes idempotentes
    for (const sale of dto.sales || []) {
      try {
        await this.processSingleSale(storeCode, source, sale);
        confirmedTransactionIds.push(sale.transactionId);
      } catch (err: any) {
        this.logger.error(
          `Error al procesar venta ${sale.transactionId} de tienda ${storeCode}: ${err.message}`,
        );
      }
    }

    // 2. Procesar turnos en lotes idempotentes si vienen en el payload
    for (const shift of dto.shifts || []) {
      try {
        await this.processSingleShift(storeCode, source, shift);
      } catch (err: any) {
        this.logger.error(
          `Error al procesar turno ${shift.shiftNo} (${shift.employeeName}) de tienda ${storeCode}: ${err.message}`,
        );
      }
    }

    // 3. Actualizar estado de la tienda en BoStore
    const now = new Date();
    await this.prisma.boStore.upsert({
      where: { code: storeCode },
      update: {
        lastSeenAt: now,
        lastSyncAt: now,
        lastSyncStatus: 'OK',
        healthStatus: 'ONLINE',
        lastSyncError: null,
      },
      create: {
        code: storeCode,
        name: dto.storeName || `Estación ${storeCode}`,
        ip: 'cloudflared',
        isActive: true,
        lastSeenAt: now,
        lastSyncAt: now,
        lastSyncStatus: 'OK',
        healthStatus: 'ONLINE',
      },
    }).catch((err) => {
      this.logger.warn(`No se pudo actualizar boStore para ${storeCode}: ${err.message}`);
    });

    return {
      success: true,
      processedSales: confirmedTransactionIds.length,
      confirmedTransactionIds,
      serverTime: now.toISOString(),
    };
  }

  validateSaleIntegrity(sale: SyncSaleDto): void {
    const totalAmount = Number(sale.totalAmount) || 0;

    // Validar líneas
    const lines = sale.lines || [];
    if (lines.length === 0) {
      throw new BadRequestException(
        `Venta ${sale.transactionId} rechazada: no contiene líneas de detalle.`,
      );
    }
    const linesSum = Math.round(
      lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0) * 100,
    ) / 100;
    if (Math.abs(linesSum - totalAmount) > 0.01) {
      throw new BadRequestException(
        `Error de integridad en venta ${sale.transactionId}: la suma de líneas (${linesSum.toFixed(2)}) no coincide con el total (${totalAmount.toFixed(2)}).`,
      );
    }

    // Validar pagos
    const payments = sale.payments || [];
    if (payments.length === 0) {
      throw new BadRequestException(
        `Venta ${sale.transactionId} rechazada: no contiene métodos de pago.`,
      );
    }
    const paymentsSum = Math.round(
      payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0) * 100,
    ) / 100;
    if (Math.abs(paymentsSum - totalAmount) > 0.01) {
      throw new BadRequestException(
        `Error de integridad en venta ${sale.transactionId}: la suma de pagos (${paymentsSum.toFixed(2)}) no coincide con el total (${totalAmount.toFixed(2)}).`,
      );
    }
  }

  private async processSingleSale(storeCode: string, source: string, sale: SyncSaleDto) {
    this.validateSaleIntegrity(sale);
    const shiftDateObj = new Date(sale.shiftDate);

    await this.prisma.$transaction(async (tx) => {
      // Header
      const header = await tx.boSaleHeader.upsert({
        where: {
          source_storeCode_transactionId: {
            source,
            storeCode,
            transactionId: sale.transactionId,
          },
        },
        update: {
          docType: sale.docType,
          docNo: sale.docNo,
          appliedDocNo: sale.appliedDocNo || null,
          shiftDate: shiftDateObj,
          shiftNo: sale.shiftNo,
          employeeName: sale.employeeName,
          customerNo: sale.customerNo || null,
          customerName: sale.customerName || null,
          rtn: sale.rtn || null,
          subTotal: sale.subTotal,
          totalAmount: sale.totalAmount,
          km: sale.km || null,
          orden: sale.orden || null,
          placa: sale.placa || null,
          chofer: sale.chofer || null,
          reconcilerShiftId: sale.reconcilerShiftId || null,
          creditValidationSource: sale.creditValidationSource || null,
        },
        create: {
          source,
          storeCode,
          transactionId: sale.transactionId,
          docType: sale.docType,
          docNo: sale.docNo,
          appliedDocNo: sale.appliedDocNo || null,
          shiftDate: shiftDateObj,
          shiftNo: sale.shiftNo,
          employeeName: sale.employeeName,
          customerNo: sale.customerNo || null,
          customerName: sale.customerName || null,
          rtn: sale.rtn || null,
          subTotal: sale.subTotal,
          totalAmount: sale.totalAmount,
          km: sale.km || null,
          orden: sale.orden || null,
          placa: sale.placa || null,
          chofer: sale.chofer || null,
          reconcilerShiftId: sale.reconcilerShiftId || null,
          creditValidationSource: sale.creditValidationSource || null,
        },
      });

      // Lines
      for (const line of sale.lines || []) {
        await tx.boSale.upsert({
          where: {
            source_storeCode_externalId_lineNo: {
              source,
              storeCode,
              externalId: line.externalId,
              lineNo: line.lineNo,
            },
          },
          update: {
            saleIdFusion: line.saleIdFusion || null,
            timestamp: new Date(line.timestamp),
            shiftNo: line.shiftNo || sale.shiftNo,
            shiftDate: line.shiftDate ? new Date(line.shiftDate) : shiftDateObj,
            amount: line.amount,
            volume: line.volume != null ? line.volume : null,
            unitPrice: line.unitPrice != null ? line.unitPrice : null,
            productName: line.productName || null,
            productCode: line.productCode || null,
            unitOfMeasure: line.unitOfMeasure || null,
            pumpId: line.pumpId || null,
            hoseId: line.hoseId || null,
            tankId: line.tankId || null,
            discount: line.discount != null ? line.discount : null,
            discountPct: line.discountPct != null ? line.discountPct : null,
            docType: sale.docType,
            appliedDocNo: sale.appliedDocNo || null,
            saleHeaderId: header.id,
          },
          create: {
            source,
            storeCode,
            externalId: line.externalId,
            lineNo: line.lineNo,
            saleIdFusion: line.saleIdFusion || null,
            timestamp: new Date(line.timestamp),
            shiftNo: line.shiftNo || sale.shiftNo,
            shiftDate: line.shiftDate ? new Date(line.shiftDate) : shiftDateObj,
            amount: line.amount,
            volume: line.volume != null ? line.volume : null,
            unitPrice: line.unitPrice != null ? line.unitPrice : null,
            productName: line.productName || null,
            productCode: line.productCode || null,
            unitOfMeasure: line.unitOfMeasure || null,
            pumpId: line.pumpId || null,
            hoseId: line.hoseId || null,
            tankId: line.tankId || null,
            discount: line.discount != null ? line.discount : null,
            discountPct: line.discountPct != null ? line.discountPct : null,
            docType: sale.docType,
            appliedDocNo: sale.appliedDocNo || null,
            saleHeaderId: header.id,
          },
        });

        // Descontar inventario central si la línea corresponde a un producto con código o mercancía
        const itemCode = line.productCode || (!line.pumpId && line.productName ? line.productName : null);
        if (itemCode && tx.boInventory?.upsert) {
          const qty = Number(line.volume) || 1;
          await tx.boInventory.upsert({
            where: {
              storeCode_productCode: {
                storeCode,
                productCode: itemCode,
              },
            },
            update: {
              stock: { decrement: qty },
              ...(line.productName ? { productName: line.productName } : {}),
            },
            create: {
              storeCode,
              productCode: itemCode,
              productName: line.productName || null,
              stock: -qty,
              minStock: 0,
            },
          }).catch((err) => {
            this.logger.warn(`No se pudo actualizar inventario HQ para ${itemCode} en tienda ${storeCode}: ${err.message}`);
          });
        }
      }

      // Payments
      for (const pay of sale.payments || []) {
        await tx.boPaymentMethod.upsert({
          where: {
            source_storeCode_transactionId_chargeLineNo: {
              source,
              storeCode,
              transactionId: sale.transactionId,
              chargeLineNo: pay.chargeLineNo,
            },
          },
          update: {
            shiftDate: shiftDateObj,
            shiftNo: sale.shiftNo,
            employeeName: sale.employeeName,
            chargeMethodCode: pay.chargeMethodCode,
            description: pay.description,
            amount: pay.amount,
            paymentCardNo: pay.paymentCardNo || null,
            additionalData: pay.additionalData || null,
            esTicket: pay.esTicket || false,
          },
          create: {
            source,
            storeCode,
            transactionId: sale.transactionId,
            chargeLineNo: pay.chargeLineNo,
            shiftDate: shiftDateObj,
            shiftNo: sale.shiftNo,
            employeeName: sale.employeeName,
            chargeMethodCode: pay.chargeMethodCode,
            description: pay.description,
            amount: pay.amount,
            paymentCardNo: pay.paymentCardNo || null,
            additionalData: pay.additionalData || null,
            esTicket: pay.esTicket || false,
          },
        });
      }
    });

    // Re-evaluar turno si está esperando ventas
    await this.reevaluateShiftOnSale(storeCode, source, sale);
  }

  private async reevaluateShiftOnSale(storeCode: string, source: string, sale: SyncSaleDto) {
    try {
      const shiftDateObj = new Date(sale.shiftDate);
      const shift = await this.prisma.boShift.findUnique({
        where: {
          source_storeCode_shiftDate_shiftNo_employeeName: {
            source,
            storeCode,
            shiftDate: shiftDateObj,
            shiftNo: sale.shiftNo,
            employeeName: sale.employeeName,
          },
        },
      });

      if (shift && shift.auditStatus === 'SYNC_IN_PROGRESS' && shift.presentationDetails) {
        let details: any = {};
        try {
          details = JSON.parse(shift.presentationDetails);
        } catch {
          return;
        }

        const expectedCount = Number(details.expectedCount) || 0;
        if (expectedCount > 0) {
          const salesInDb = await this.prisma.boSaleHeader.findMany({
            where: {
              source,
              storeCode,
              shiftDate: shiftDateObj,
              shiftNo: sale.shiftNo,
              employeeName: sale.employeeName,
            },
            select: { totalAmount: true },
          });

          const actualCount = salesInDb.length;
          if (actualCount >= expectedCount) {
            const actualAmount = Math.round(
              salesInDb.reduce((s, v) => s + (Number(v.totalAmount) || 0), 0) * 100,
            ) / 100;
            const declared = Math.round(
              (Number(shift.cashDeclared || 0) +
                Number(shift.cardDeclared || 0) +
                Number(shift.otherDeclared || 0)) * 100,
            ) / 100;
            const variance = Math.round((declared - actualAmount) * 100) / 100;
            const isBalanced = Math.abs(variance) < 0.01;
            const auditStatus = isBalanced ? 'BALANCED' : 'DISCREPANCY';

            await this.prisma.boShift.update({
              where: { id: shift.id },
              data: {
                auditStatus,
                isBalanced,
                cashVariance: variance,
                presentationDetails: JSON.stringify({
                  ...details,
                  actualCount,
                  actualAmount,
                  reconciledAt: new Date().toISOString(),
                }),
              },
            });

            if (auditStatus === 'DISCREPANCY' && variance !== null) {
              await this.checkAndDispatchShiftDiscrepancyAlert(storeCode, {
                shiftDate: shiftDateObj,
                shiftNo: sale.shiftNo,
                employeeName: sale.employeeName,
                totalSale: actualAmount,
                cashDeclared: Number(shift.cashDeclared || 0),
                cashVariance: variance,
              });
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.debug(
        `Error re-evaluando turno para venta ${sale.transactionId}: ${err.message}`,
      );
    }
  }

  private async processSingleShift(storeCode: string, source: string, shift: SyncShiftDto) {
    const shiftDateObj = new Date(shift.shiftDate);
    const isOpen = shift.status === 'OPEN' || !shift.endTime;

    let auditStatus = 'OPEN_OPERATIONAL';
    let isBalanced = false;
    let cashVariance: number | null = null;
    let presentationDetails: string | null = null;

    if (!isOpen) {
      // Turno CERRADO: evaluar si las ventas físicas están completas
      const salesInDb = await this.prisma.boSaleHeader.findMany({
        where: {
          source,
          storeCode,
          shiftDate: shiftDateObj,
          shiftNo: shift.shiftNo,
          employeeName: shift.employeeName,
        },
        select: { totalAmount: true },
      });

      const actualCount = salesInDb.length;
      const actualAmount = Math.round(
        salesInDb.reduce((s, v) => s + (Number(v.totalAmount) || 0), 0) * 100,
      ) / 100;
      const expectedCount = shift.controlTotals?.totalSalesCount;
      const expectedAmount = shift.controlTotals?.totalSalesAmount ?? shift.totalSale;

      if (expectedCount != null && actualCount < expectedCount) {
        // Aún faltan ventas por sincronizar
        auditStatus = 'SYNC_IN_PROGRESS';
        isBalanced = false;
        cashVariance = null;
        presentationDetails = JSON.stringify({
          expectedCount,
          actualCount,
          expectedAmount,
          actualAmount,
          controlTotals: shift.controlTotals,
        });
      } else {
        // Ventas completas: calcular cuadre
        const declared = Math.round(
          (Number(shift.cashDeclared || 0) +
            Number(shift.cardDeclared || 0) +
            Number(shift.otherDeclared || 0)) * 100,
        ) / 100;
        const theoretical = expectedCount != null ? actualAmount : Number(shift.totalSale || 0);
        cashVariance = Math.round((declared - theoretical) * 100) / 100;
        isBalanced = Math.abs(cashVariance) < 0.01;
        auditStatus = isBalanced ? 'BALANCED' : 'DISCREPANCY';
        presentationDetails = JSON.stringify({
          expectedCount: expectedCount ?? actualCount,
          actualCount,
          expectedAmount,
          actualAmount,
          controlTotals: shift.controlTotals,
          reconciledAt: new Date().toISOString(),
        });
      }
    }

    await this.prisma.boShift.upsert({
      where: {
        source_storeCode_shiftDate_shiftNo_employeeName: {
          source,
          storeCode,
          shiftDate: shiftDateObj,
          shiftNo: shift.shiftNo,
          employeeName: shift.employeeName,
        },
      },
      update: {
        startTime: new Date(shift.startTime),
        endTime: shift.endTime ? new Date(shift.endTime) : null,
        status: shift.status,
        totalSale: shift.totalSale,
        totalDiscount: shift.totalDiscount,
        cashDeclared: shift.cashDeclared != null ? shift.cashDeclared : null,
        cardDeclared: shift.cardDeclared != null ? shift.cardDeclared : null,
        otherDeclared: shift.otherDeclared != null ? shift.otherDeclared : null,
        version: shift.version != null ? shift.version : 1,
        auditStatus,
        isBalanced,
        cashVariance,
        presentationDetails,
      },
      create: {
        source,
        storeCode,
        shiftDate: shiftDateObj,
        shiftNo: shift.shiftNo,
        employeeName: shift.employeeName,
        startTime: new Date(shift.startTime),
        endTime: shift.endTime ? new Date(shift.endTime) : null,
        status: shift.status,
        totalSale: shift.totalSale,
        totalDiscount: shift.totalDiscount,
        cashDeclared: shift.cashDeclared != null ? shift.cashDeclared : null,
        cardDeclared: shift.cardDeclared != null ? shift.cardDeclared : null,
        otherDeclared: shift.otherDeclared != null ? shift.otherDeclared : null,
        version: shift.version != null ? shift.version : 1,
        auditStatus,
        isBalanced,
        cashVariance,
        presentationDetails,
      },
    });

    if (auditStatus === 'DISCREPANCY' && cashVariance !== null) {
      await this.checkAndDispatchShiftDiscrepancyAlert(storeCode, {
        shiftDate: shiftDateObj,
        shiftNo: shift.shiftNo,
        employeeName: shift.employeeName,
        totalSale: Number(shift.totalSale || 0),
        cashDeclared: Number(shift.cashDeclared || 0),
        cashVariance,
      });
    }
  }

  private async checkAndDispatchShiftDiscrepancyAlert(
    storeCode: string,
    shift: {
      shiftDate: string | Date;
      shiftNo: string;
      employeeName: string;
      totalSale: number;
      cashDeclared: number;
      cashVariance: number;
    },
  ) {
    if (!this.alertConfigService || !this.brevoService) {
      return;
    }

    try {
      const config = await this.alertConfigService.getConfig();

      if (!config.alertsEnabled || !config.shiftDiscrepancyEnabled) {
        return;
      }

      if (!config.recipientEmails || config.recipientEmails.length === 0) {
        return;
      }

      const varianceAbs = Math.abs(shift.cashVariance);
      if (varianceAbs >= config.cashVarianceThreshold) {
        const shiftDateStr =
          shift.shiftDate instanceof Date
            ? shift.shiftDate.toISOString().substring(0, 10)
            : String(shift.shiftDate).substring(0, 10);

        const { subject, html } = AlertTemplateBuilder.buildShiftDiscrepancyTemplate({
          storeCode,
          shiftDate: shiftDateStr,
          shiftNo: shift.shiftNo,
          employeeName: shift.employeeName,
          totalSale: shift.totalSale,
          cashDeclared: shift.cashDeclared,
          cashVariance: shift.cashVariance,
        });

        // Despacho asíncrono no bloqueante
        void this.brevoService
          .sendEmail({
            to: config.recipientEmails,
            subject,
            htmlContent: html,
          })
          .catch((err) => {
            this.logger.error(`Error enviando alerta de descuadre: ${err.message}`);
          });
      }
    } catch (err: any) {
      this.logger.debug(
        `Error al evaluar alerta de descuadre para tienda ${storeCode}: ${err.message}`,
      );
    }
  }

  private masterVersionOffset = 0;

  bumpMasterVersion(): number {
    this.masterVersionOffset += 1;
    return this.getMasterVersion();
  }

  getMasterVersion(): number {
    return Math.floor(Date.now() / 60000) + this.masterVersionOffset;
  }

  async getMasters(storeCode: string, sinceVersion?: number): Promise<SyncMastersResponseDto> {
    const now = new Date();
    // Versión secuencial basada en época + offset reactivo de cambios
    const currentVersion = this.getMasterVersion();

    if (sinceVersion && sinceVersion >= currentVersion) {
      return {
        masterVersion: currentVersion,
        generatedAt: now.toISOString(),
        hasUpdates: false,
        customers: [],
        fuelPrices: [],
        products: [],
        discountRules: [],
        users: [],
      };
    }

    // Consultar precios de combustible configurados en BoHose para la tienda
    const hoses = await this.prisma.boHose.findMany({
      where: { storeCode, active: true },
      select: {
        gradeId: true,
        gradeName: true,
        updatedAt: true,
      },
    });

    const fuelPrices = hoses.map((h) => ({
      gradeId: h.gradeId,
      gradeName: h.gradeName,
      unitPrice: 0,
      effectiveDate: h.updatedAt.toISOString(),
    }));

    // Consultar catálogo central de usuarios y credenciales para replicación al POS
    let usersList: any[] = [];
    if (this.prisma.user?.findMany) {
      usersList = await this.prisma.user.findMany({
        select: {
          username: true,
          name: true,
          password: true,
          role: true,
          isActive: true,
        },
        orderBy: { username: 'asc' },
      });
    }

    const users: SyncMasterUserDto[] = usersList.map((u) => ({
      username: u.username,
      name: u.name,
      passwordHash: u.password,
      role: u.role,
      active: u.isActive,
    }));

    // Consultar el catálogo central de clientes desde la casa matriz (000).
    const customers = await this.getCentralCustomers();

    // Consultar catálogo central de formas de pago y sus asignaciones por tienda
    const allPaymentMethods = await this.prisma.boPaymentMethodCatalog.findMany({
      include: { storeAssignments: true },
      orderBy: { code: 'asc' },
    });

    const paymentMethods = allPaymentMethods.map((pm) => {
      const isAssignedToStore = pm.storeAssignments.some(
        (sa) => sa.storeCode === storeCode && sa.active,
      );
      return {
        code: pm.code,
        description: pm.description,
        category: pm.category,
        currency: pm.currency,
        generatesChange: pm.generatesChange,
        invoiceCash: pm.invoiceCash,
        invoiceCredit: pm.invoiceCredit,
        fuelOutflow: pm.fuelOutflow,
        loyalty: pm.loyalty,
        requiresReference: pm.requiresReference,
        image: pm.image,
        active: pm.active && isAssignedToStore,
        accountId: pm.accountId,
        commissionPct: pm.commissionPct ? Number(pm.commissionPct) : null,
      };
    });

    // Consultar tasas de cambio activas
    const dbExchangeRates = await this.prisma.boExchangeRate.findMany({
      where: { active: true },
      orderBy: { startDate: 'desc' },
    });

    const exchangeRates = dbExchangeRates.map((er) => ({
      id: er.id,
      currency: er.currency,
      rate: Number(er.rate),
      startDate: er.startDate.toISOString(),
      endDate: er.endDate ? er.endDate.toISOString() : null,
      active: er.active,
    }));

    return {
      masterVersion: currentVersion,
      generatedAt: now.toISOString(),
      hasUpdates: true,
      customers,
      fuelPrices,
      products: [],
      discountRules: [],
      users,
      paymentMethods,
      exchangeRates,
    };
  }

  /**
   * Lee el catálogo de clientes de la casa matriz (000) vía su pool TPV y lo
   * mapea al DTO de maestros. Si la tienda 000 no tiene clientes o no es
   * accesible, devuelve [] (no rompe el resto de maestros).
   */
  private async getCentralCustomers(): Promise<SyncMasterCustomerDto[]> {
    let tpv: any | null = null;
    try {
      if (this.connectionFactory) {
        tpv = await this.connectionFactory.getTpvConnection(HQ_STORE_CODE);
      }
      const result = await tpv.query(`
        SELECT codigo, nombre, rtn, telefono, correo, direccion,
               tipo_facturacion, bloqueado, saldo, limite_credito, dias_credito, bloqueo_mora
        FROM clientes
        ORDER BY codigo
      `);
      const rows = (result?.recordset || []) as any[];
      return rows.map((row: any) => ({
        customerNo: String(row.codigo || '').trim(),
        customerName: String(row.nombre || row.codigo || '').trim(),
        rtn: row.rtn ? String(row.rtn).trim() : null,
        phone: row.telefono ? String(row.telefono).trim() : null,
        email: row.correo ? String(row.correo).trim() : null,
        address: row.direccion ? String(row.direccion).trim() : null,
        billingType: Number(row.tipo_facturacion) === 0 ? 0 : 1,
        blocked: row.bloqueado === true || row.bloqueado === 1,
        creditLimit: row.limite_credito != null ? Number(row.limite_credito) : null,
        creditDays: row.dias_credito != null ? Number(row.dias_credito) : 30,
        blockOnOverdue: row.bloqueo_mora ?? true,
        balance: row.saldo != null ? Number(row.saldo) : null,
      }));
    } catch (error: any) {
      this.logger.warn(
        `No se pudo cargar el catálogo central de clientes (tienda ${HQ_STORE_CODE}): ${error.message}`,
      );
      return [];
    } finally {
      if (tpv) await tpv.close().catch(() => undefined);
    }
  }

  /**
   * Replica clientes de CONTADO creados localmente en un POS hacia la casa
   * matriz (000). Solo se aceptan clientes de contado (billingType = 1): los
   * intentos de crédito desde el POS se ignoran (el crédito vive solo en la
   * matriz). El upsert es por codigo y respeta el código original CCO-{tienda}-{6}.
   */
  async syncUpCustomers(dto: {
    storeCode?: string;
    customers?: Array<{
      customerNo: string;
      customerName: string;
      rtn?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      billingType?: number;
      blocked?: boolean;
    }>;
  }) {
    const storeCode = (dto.storeCode || '').trim();
    if (!storeCode) {
      throw new BadRequestException('El código de tienda (storeCode) es obligatorio.');
    }
    const incoming = Array.isArray(dto.customers) ? dto.customers : [];
    // Solo contado: el POS no puede registrar clientes de crédito.
    const cashCustomers = incoming.filter((c) => Number(c.billingType) !== 0);

    let tpv: any | null = null;
    let inserted = 0;
    try {
      if (this.connectionFactory) {
        tpv = await this.connectionFactory.getTpvConnection(HQ_STORE_CODE);
      }
      for (const cust of cashCustomers) {
        const customerNo = String(cust.customerNo || '').trim();
        if (!customerNo) continue;
        const existing = await tpv.queryParams(
          `SELECT codigo FROM clientes WHERE codigo = @customerNo`,
          { customerNo },
        );
        if (existing.recordset.length > 0) {
          // Ya está en el catálogo central: no duplicar, no pisar un crédito.
          await tpv.queryParams(
            `UPDATE clientes SET nombre = @name, fecha_actualizacion = now()
             WHERE codigo = @customerNo AND (tipo_facturacion IS NULL OR tipo_facturacion <> 0)`,
            {
              customerNo,
              name: String(cust.customerName || customerNo).trim(),
            },
          );
        } else {
          await tpv.queryParams(
            `INSERT INTO clientes (codigo, nombre, rtn, telefono, correo, direccion, tipo_facturacion, bloqueado, fecha_actualizacion)
             VALUES (@customerNo, @name, @rtn, @phone, @email, @address, 1, false, now())`,
            {
              customerNo,
              name: String(cust.customerName || customerNo).trim(),
              rtn: cust.rtn ? String(cust.rtn).trim() : '',
              phone: cust.phone ? String(cust.phone).trim() : '',
              email: cust.email ? String(cust.email).trim() : '',
              address: cust.address ? String(cust.address).trim() : '',
            },
          );
          inserted++;
        }
      }
      this.logger.log(
        `[SYNC UP] Tienda ${storeCode} envió ${cashCustomers.length} cliente(s) de contado; ${inserted} nuevos en casa matriz (000)`,
      );
      return {
        success: true,
        received: incoming.length,
        accepted: cashCustomers.length,
        inserted,
      };
    } catch (error: any) {
      this.logger.error(
        `Error replicando clientes de contado de tienda ${storeCode} hacia 000: ${error.message}`,
      );
      throw new BadRequestException(
        `Error replicando clientes de contado: ${error.message}`,
      );
    } finally {
      if (tpv) await tpv.close().catch(() => undefined);
    }
  }

  async ping(storeCode: string, queueCount?: number) {
    const now = new Date();
    await this.prisma.boStore.upsert({
      where: { code: storeCode },
      update: {
        lastSeenAt: now,
        healthStatus: 'ONLINE',
      },
      create: {
        code: storeCode,
        name: `Estación ${storeCode}`,
        ip: 'cloudflared',
        isActive: true,
        lastSeenAt: now,
        healthStatus: 'ONLINE',
      },
    }).catch(() => {});

    return {
      status: 'pong',
      storeCode,
      serverTime: now.toISOString(),
      queueCount: queueCount ?? 0,
    };
  }

  async getStoreConfig(storeCode: string) {
    if (!storeCode || storeCode.trim() === '') {
      throw new BadRequestException('El código de tienda (storeCode) es obligatorio.');
    }

    const cleanCode = storeCode.trim();
    const store = await this.prisma.boStore.findUnique({
      where: { code: cleanCode },
    });

    if (!store) {
      throw new NotFoundException(`Tienda con código '${cleanCode}' no encontrada en la Matriz.`);
    }

    // El Consumidor Final es un parámetro CENTRAL: se configura una sola vez en
    // la casa matriz (000) y se propaga a todas las tiendas. Si 000 no existe o
    // no tiene valor, se cae al valor local de la tienda como respaldo.
    const hq = await this.prisma.boStore.findUnique({
      where: { code: HQ_STORE_CODE },
      select: { noConsumidorFinal: true },
    });
    const centralNoConsumidorFinal = hq?.noConsumidorFinal?.trim()
      ? hq.noConsumidorFinal.trim()
      : store.noConsumidorFinal?.trim() || '';

    const hoses = await this.prisma.boHose.findMany({
      where: { storeCode: cleanCode, active: true },
      orderBy: [{ pumpId: 'asc' }, { hoseId: 'asc' }],
    });

    const now = new Date();

    return {
      storeCode: cleanCode,
      configVersion: store.configVersion ?? 1,
      generatedAt: now.toISOString(),
      tienda: {
        idTienda: store.code,
        nombre: store.name,
        rtn: store.RTN || null,
        emisor: store.emisor || null,
        titulo: store.titulo || null,
        direccion1: store.address || null,
        telefono: store.telefono || null,
        correo: store.correo || null,
        ipFusion: store.ipFusion || null,
        urlControlador: store.urlControlador || null,
        claveControlador: store.claveControlador || null,
        esControladorGas: store.esControladorGas ?? false,
        businessType: store.businessType || 'GAS_STATION',
        moneda: store.moneda || 'HNL',
        codigoMoneda: store.codigoMoneda || 'HNL',
        logoUrl: store.logoUrl || null,
        variasLineasPermitidas: true,
        descuentosPermitidos: true,
        noConsumidorFinal: centralNoConsumidorFinal || null,
      },
      configuracionPos: (store.posConfig as any) || {
        codigoPos: '01',
        pantallaEnBomba: false,
        bloquearSoloPos: false,
        mostrarVideoPublicidad: false,
        reimprimirVarios: true,
        facturarVariasLineas: true,
        descuentoManual: true,
        ocultarBotonOtrasBombas: false,
        ocultarInformacionTurnos: false,
        mostrarBombas: true,
        numTransaccionesBombas: 400,
        minutosAtrasada: 60,
        mostrarTeclado: true,
        declararMontosIniciales: true,
      },
      mangueras: hoses.map((h) => ({
        idManguera: h.pumpId * 10 + h.hoseId,
        idBomba: h.pumpId,
        idMangueraFisica: h.hosePhysicalId || h.hoseId,
        numeroGrado: h.gradeId,
        nombreGrado: h.gradeName,
        idsTanques: h.tankId || null,
        pos: h.posCode || String(h.pumpId),
        codigoPos: h.genericCode || h.posCode || String(h.pumpId),
        codigoGenerico: h.genericCode || h.posCode || String(h.gradeId),
        visible: h.active ?? true,
        unidadMedida: h.unitOfMeasure || 'GL',
        codigoMoneda: store.codigoMoneda || 'HNL',
      })),
    };
  }

  /**
   * Consulta el saldo en vivo, límite de crédito y estado de bloqueo de un cliente
   * directamente en el catálogo central de la casa matriz (000).
   */
  async getCustomerLiveBalance(customerCode: string): Promise<{
    customerNo: string;
    customerName: string;
    billingType: number;
    blocked: boolean;
    balance: number;
    creditLimit: number;
    creditDays: number;
    blockOnOverdue: boolean;
    hasOverdueInvoices: boolean;
  }> {
    const code = (customerCode || '').trim();
    if (!code) {
      throw new BadRequestException('El código de cliente es obligatorio.');
    }

    let tpv: any | null = null;
    try {
      if (this.connectionFactory) {
        tpv = await this.connectionFactory.getTpvConnection(HQ_STORE_CODE);
      }

      if (!tpv) {
        throw new NotFoundException(`No hay conexión con la casa matriz (${HQ_STORE_CODE}).`);
      }

      const result = await tpv.queryParams(
        `SELECT codigo, nombre, tipo_facturacion, bloqueado, saldo, limite_credito, dias_credito, bloqueo_mora
         FROM clientes
         WHERE codigo = @customerNo`,
        { customerNo: code },
      );

      const row = result?.recordset?.[0];
      if (!row) {
        throw new NotFoundException(`Cliente '${code}' no encontrado en la Matriz.`);
      }

      return {
        customerNo: String(row.codigo || code).trim(),
        customerName: String(row.nombre || code).trim(),
        billingType: Number(row.tipo_facturacion) === 0 ? 0 : 1,
        blocked: row.bloqueado === true || row.bloqueado === 1,
        balance: row.saldo != null ? Number(row.saldo) : 0,
        creditLimit: row.limite_credito != null ? Number(row.limite_credito) : 0,
        creditDays: row.dias_credito != null ? Number(row.dias_credito) : 30,
        blockOnOverdue: row.bloqueo_mora ?? true,
        hasOverdueInvoices: false,
      };
    } finally {
      if (tpv) await tpv.close().catch(() => undefined);
    }
  }
}

