import { Injectable, Logger, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SyncUpDto, SyncSaleDto, SyncShiftDto } from './dto/sync-up.dto';
import type { SyncMastersResponseDto } from './dto/sync-masters.dto';
import { AlertConfigService } from '../alerts/alert-config.service';
import { BrevoNotificationService } from '../alerts/brevo-notification.service';
import { AlertTemplateBuilder } from '../alerts/alert-template.builder';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
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

  async getMasters(storeCode: string, sinceVersion?: number): Promise<SyncMastersResponseDto> {
    const now = new Date();
    // Versión secuencial basada en fecha/época o contador monótono
    const currentVersion = Math.floor(now.getTime() / 60000); // Versión en minutos

    if (sinceVersion && sinceVersion >= currentVersion) {
      return {
        masterVersion: currentVersion,
        generatedAt: now.toISOString(),
        hasUpdates: false,
        customers: [],
        fuelPrices: [],
        products: [],
      };
    }

    // Consultar precios de combustible configurados en BoHose para la tienda
    const hoses = await this.prisma.boHose.findMany({
      where: { storeCode, active: true },
      select: {
        gradeId: true,
        gradeName: true,
        unitPrice: true,
        updatedAt: true,
      },
    });

    const fuelPrices = hoses.map((h) => ({
      gradeId: h.gradeId,
      gradeName: h.gradeName,
      unitPrice: Number(h.unitPrice) || 0,
      effectiveDate: h.updatedAt.toISOString(),
    }));

    return {
      masterVersion: currentVersion,
      generatedAt: now.toISOString(),
      hasUpdates: true,
      customers: [], // Puede poblarse con catálogo centralizado
      fuelPrices,
      products: [],
      discountRules: [],
    };
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
        moneda: store.moneda || 'HNL',
        codigoMoneda: store.codigoMoneda || 'HNL',
        logoUrl: store.logoUrl || null,
        variasLineasPermitidas: true,
        descuentosPermitidos: true,
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
        idManguera: h.hoseId,
        idBomba: h.pumpId,
        idMangueraFisica: h.hosePhysicalId || h.hoseId,
        numeroGrado: h.gradeId,
        nombreGrado: h.gradeName,
        precioUnitario: Number(h.unitPrice) || 0,
        idsTanques: h.tankId || null,
        pos: h.posCode || String(h.pumpId),
        codigoPos: h.posCode || String(h.pumpId),
        codigoGenerico: h.genericCode || String(h.gradeId),
        visible: h.active ?? true,
        unidadMedida: h.unitOfMeasure || 'GL',
        codigoMoneda: store.codigoMoneda || 'HNL',
      })),
    };
  }
}
