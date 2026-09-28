import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STANDARD_ACCOUNTS = [
  // Nivel 1: Clases
  { code: '1', name: 'ACTIVO', type: 'ASSET', nature: 'DEBIT', level: 1, allowsMovement: false },
  { code: '2', name: 'PASIVO', type: 'LIABILITY', nature: 'CREDIT', level: 1, allowsMovement: false },
  { code: '3', name: 'PATRIMONIO', type: 'EQUITY', nature: 'CREDIT', level: 1, allowsMovement: false },
  { code: '4', name: 'INGRESOS', type: 'REVENUE', nature: 'CREDIT', level: 1, allowsMovement: false },
  { code: '5', name: 'COSTOS', type: 'COST', nature: 'DEBIT', level: 1, allowsMovement: false },
  { code: '6', name: 'GASTOS', type: 'EXPENSE', nature: 'DEBIT', level: 1, allowsMovement: false },

  // Nivel 2: Grupos
  { code: '1.1', name: 'ACTIVO CORRIENTE', type: 'ASSET', nature: 'DEBIT', level: 2, parentCode: '1', allowsMovement: false },
  { code: '1.2', name: 'ACTIVO NO CORRIENTE', type: 'ASSET', nature: 'DEBIT', level: 2, parentCode: '1', allowsMovement: false },
  { code: '2.1', name: 'PASIVO CORRIENTE', type: 'LIABILITY', nature: 'CREDIT', level: 2, parentCode: '2', allowsMovement: false },
  { code: '3.1', name: 'CAPITAL Y RESERVAS', type: 'EQUITY', nature: 'CREDIT', level: 2, parentCode: '3', allowsMovement: false },
  { code: '4.1', name: 'INGRESOS OPERACIONALES POR VENTAS', type: 'REVENUE', nature: 'CREDIT', level: 2, parentCode: '4', allowsMovement: false },
  { code: '4.2', name: 'OTROS INGRESOS', type: 'REVENUE', nature: 'CREDIT', level: 2, parentCode: '4', allowsMovement: false },
  { code: '5.1', name: 'COSTO DE VENTAS', type: 'COST', nature: 'DEBIT', level: 2, parentCode: '5', allowsMovement: false },
  { code: '6.1', name: 'GASTOS OPERATIVOS DE ADMINISTRACIÓN Y VENTA', type: 'EXPENSE', nature: 'DEBIT', level: 2, parentCode: '6', allowsMovement: false },

  // Nivel 3: Cuentas de Mayor
  { code: '1.1.01', name: 'Efectivo y Equivalentes de Efectivo', type: 'ASSET', nature: 'DEBIT', level: 3, parentCode: '1.1', allowsMovement: false },
  { code: '1.1.02', name: 'Cuentas por Cobrar Comerciales y Otras', type: 'ASSET', nature: 'DEBIT', level: 3, parentCode: '1.1', allowsMovement: false },
  { code: '1.1.03', name: 'Inventarios', type: 'ASSET', nature: 'DEBIT', level: 3, parentCode: '1.1', allowsMovement: false },
  { code: '1.1.04', name: 'Crédito Fiscal e Impuestos a Favor', type: 'ASSET', nature: 'DEBIT', level: 3, parentCode: '1.1', allowsMovement: false },
  { code: '2.1.01', name: 'Cuentas por Pagar Comerciales', type: 'LIABILITY', nature: 'CREDIT', level: 3, parentCode: '2.1', allowsMovement: false },
  { code: '2.1.02', name: 'Obligaciones Laborales con Empleados', type: 'LIABILITY', nature: 'CREDIT', level: 3, parentCode: '2.1', allowsMovement: false },
  { code: '2.1.03', name: 'Obligaciones Fiscales y Retenciones', type: 'LIABILITY', nature: 'CREDIT', level: 3, parentCode: '2.1', allowsMovement: false },
  { code: '3.1.01', name: 'Capital Social', type: 'EQUITY', nature: 'CREDIT', level: 3, parentCode: '3.1', allowsMovement: false },
  { code: '3.1.02', name: 'Resultados Acumulados', type: 'EQUITY', nature: 'CREDIT', level: 3, parentCode: '3.1', allowsMovement: false },
  { code: '3.1.03', name: 'Resultado del Ejercicio Actual', type: 'EQUITY', nature: 'CREDIT', level: 3, parentCode: '3.1', allowsMovement: false },
  { code: '4.1.01', name: 'Venta de Combustibles', type: 'REVENUE', nature: 'CREDIT', level: 3, parentCode: '4.1', allowsMovement: false },
  { code: '4.1.02', name: 'Venta Tienda de Conveniencia y Pista', type: 'REVENUE', nature: 'CREDIT', level: 3, parentCode: '4.1', allowsMovement: false },
  { code: '4.2.01', name: 'Ingresos Diversos y Ajustes de Caja', type: 'REVENUE', nature: 'CREDIT', level: 3, parentCode: '4.2', allowsMovement: false },
  { code: '5.1.01', name: 'Costo de Ventas Combustibles', type: 'COST', nature: 'DEBIT', level: 3, parentCode: '5.1', allowsMovement: false },
  { code: '5.1.02', name: 'Costo de Ventas Tienda y Lubricantes', type: 'COST', nature: 'DEBIT', level: 3, parentCode: '5.1', allowsMovement: false },
  { code: '6.1.01', name: 'Gastos de Personal', type: 'EXPENSE', nature: 'DEBIT', level: 3, parentCode: '6.1', allowsMovement: false },
  { code: '6.1.02', name: 'Servicios Públicos y Generales', type: 'EXPENSE', nature: 'DEBIT', level: 3, parentCode: '6.1', allowsMovement: false },
  { code: '6.1.03', name: 'Mantenimiento y Reparación de Estación', type: 'EXPENSE', nature: 'DEBIT', level: 3, parentCode: '6.1', allowsMovement: false },
  { code: '6.1.04', name: 'Comisiones Bancarias y Datáfonos POS', type: 'EXPENSE', nature: 'DEBIT', level: 3, parentCode: '6.1', allowsMovement: false },

  // Nivel 4: Subcuentas de Movimiento (Imputables)
  { code: '1.1.01.01', name: 'Caja General - Bóveda Estación', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.01', allowsMovement: true },
  { code: '1.1.01.02', name: 'Caja Chica Operativa', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.01', allowsMovement: true },
  { code: '1.1.01.03', name: 'Bancos - Cuenta Operativa HNL', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.01', allowsMovement: true },
  { code: '1.1.01.04', name: 'Bancos - Cuenta Recaudadora USD', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.01', allowsMovement: true },
  { code: '1.1.02.01', name: 'Clientes Comerciales (Crédito Flotas y Empresas)', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.02', allowsMovement: true },
  { code: '1.1.02.02', name: 'Liquidaciones Pendientes Tarjetas de Crédito / Débito POS', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.02', allowsMovement: true },
  { code: '1.1.02.03', name: 'Faltantes de Caja por Cobrar a Empleados', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.02', allowsMovement: true },
  { code: '1.1.02.04', name: 'Anticipos y Préstamos a Empleados', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.02', allowsMovement: true },
  { code: '1.1.03.01', name: 'Inventario Combustible Gasolina Superior', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.03', allowsMovement: true },
  { code: '1.1.03.02', name: 'Inventario Combustible Gasolina Regular', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.03', allowsMovement: true },
  { code: '1.1.03.03', name: 'Inventario Combustible Diésel', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.03', allowsMovement: true },
  { code: '1.1.03.04', name: 'Inventario Lubricantes y Aditivos', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.03', allowsMovement: true },
  { code: '1.1.03.05', name: 'Inventario Mercadería Tienda de Conveniencia', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.03', allowsMovement: true },
  { code: '1.1.04.01', name: 'Crédito Fiscal ISV 15%', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.04', allowsMovement: true },
  { code: '1.1.04.02', name: 'Anticipo 1% Retención SAR en Tarjetas', type: 'ASSET', nature: 'DEBIT', level: 4, parentCode: '1.1.04', allowsMovement: true },
  { code: '2.1.01.01', name: 'Proveedores de Combustible (Distribuidora / Importadora)', type: 'LIABILITY', nature: 'CREDIT', level: 4, parentCode: '2.1.01', allowsMovement: true },
  { code: '2.1.01.02', name: 'Proveedores de Mercadería Tienda y Lubricantes', type: 'LIABILITY', nature: 'CREDIT', level: 4, parentCode: '2.1.01', allowsMovement: true },
  { code: '2.1.01.03', name: 'Acreedores Varios y Servicios', type: 'LIABILITY', nature: 'CREDIT', level: 4, parentCode: '2.1.01', allowsMovement: true },
  { code: '2.1.02.01', name: 'Sueldos y Salarios por Pagar', type: 'LIABILITY', nature: 'CREDIT', level: 4, parentCode: '2.1.02', allowsMovement: true },
  { code: '2.1.02.02', name: 'Retenciones Laborales (IHSS/RAP/INFOP) por Pagar', type: 'LIABILITY', nature: 'CREDIT', level: 4, parentCode: '2.1.02', allowsMovement: true },
  { code: '2.1.03.01', name: 'Débito Fiscal ISV 15% (Ventas Tienda / Servicios)', type: 'LIABILITY', nature: 'CREDIT', level: 4, parentCode: '2.1.03', allowsMovement: true },
  { code: '2.1.03.02', name: 'Débito Fiscal ISV 18% (Venta Licores y Cigarrillos)', type: 'LIABILITY', nature: 'CREDIT', level: 4, parentCode: '2.1.03', allowsMovement: true },
  { code: '2.1.03.03', name: 'Sobrantes de Caja por Liquidar', type: 'LIABILITY', nature: 'CREDIT', level: 4, parentCode: '2.1.03', allowsMovement: true },
  { code: '4.1.01.01', name: 'Ventas Gasolina Superior', type: 'REVENUE', nature: 'CREDIT', level: 4, parentCode: '4.1.01', allowsMovement: true },
  { code: '4.1.01.02', name: 'Ventas Gasolina Regular', type: 'REVENUE', nature: 'CREDIT', level: 4, parentCode: '4.1.01', allowsMovement: true },
  { code: '4.1.01.03', name: 'Ventas Diésel', type: 'REVENUE', nature: 'CREDIT', level: 4, parentCode: '4.1.01', allowsMovement: true },
  { code: '4.1.01.04', name: 'Descuentos Otorgados en Combustibles', type: 'REVENUE', nature: 'DEBIT', level: 4, parentCode: '4.1.01', allowsMovement: true },
  { code: '4.1.02.01', name: 'Ventas Lubricantes y Aditivos', type: 'REVENUE', nature: 'CREDIT', level: 4, parentCode: '4.1.02', allowsMovement: true },
  { code: '4.1.02.02', name: 'Ventas Mercadería Tienda de Conveniencia', type: 'REVENUE', nature: 'CREDIT', level: 4, parentCode: '4.1.02', allowsMovement: true },
  { code: '4.1.02.03', name: 'Ventas Servicios de Pista (Lavado/Calibración)', type: 'REVENUE', nature: 'CREDIT', level: 4, parentCode: '4.1.02', allowsMovement: true },
  { code: '4.2.01.01', name: 'Ingresos por Sobrantes de Caja Definitivos', type: 'REVENUE', nature: 'CREDIT', level: 4, parentCode: '4.2.01', allowsMovement: true },
  { code: '4.2.01.02', name: 'Otros Ingresos y Comisiones', type: 'REVENUE', nature: 'CREDIT', level: 4, parentCode: '4.2.01', allowsMovement: true },
  { code: '5.1.01.01', name: 'Costo de Ventas Combustibles', type: 'COST', nature: 'DEBIT', level: 4, parentCode: '5.1.01', allowsMovement: true },
  { code: '5.1.02.01', name: 'Costo de Ventas Tienda y Lubricantes', type: 'COST', nature: 'DEBIT', level: 4, parentCode: '5.1.02', allowsMovement: true },
  { code: '6.1.01.01', name: 'Sueldos, Horas Extras y Salarios', type: 'EXPENSE', nature: 'DEBIT', level: 4, parentCode: '6.1.01', allowsMovement: true },
  { code: '6.1.02.01', name: 'Energía Eléctrica y Agua Potable', type: 'EXPENSE', nature: 'DEBIT', level: 4, parentCode: '6.1.02', allowsMovement: true },
  { code: '6.1.03.01', name: 'Mantenimiento Preventivo y Correctivo Bombas', type: 'EXPENSE', nature: 'DEBIT', level: 4, parentCode: '6.1.03', allowsMovement: true },
  { code: '6.1.04.01', name: 'Comisiones y Retenciones Bancarias POS', type: 'EXPENSE', nature: 'DEBIT', level: 4, parentCode: '6.1.04', allowsMovement: true },
];

async function main() {
  console.log('[SEED-ACCOUNTING] Iniciando sembrado del módulo contable...');

  // 1. Insertar catálogo de cuentas
  const accountMap = new Map();

  for (const acc of STANDARD_ACCOUNTS) {
    let parentId = null;
    if (acc.parentCode && accountMap.has(acc.parentCode)) {
      parentId = accountMap.get(acc.parentCode);
    }

    const created = await prisma.account.upsert({
      where: { code: acc.code },
      update: {
        name: acc.name,
        type: acc.type,
        nature: acc.nature,
        level: acc.level,
        allowsMovement: acc.allowsMovement,
        parentId,
      },
      create: {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        nature: acc.nature,
        level: acc.level,
        allowsMovement: acc.allowsMovement,
        parentId,
      },
    });

    accountMap.set(acc.code, created.id);
  }
  console.log(`[SEED-ACCOUNTING] Catálogo de cuentas insertado: ${STANDARD_ACCOUNTS.length} cuentas.`);

  // 2. Insertar Centros de Costo desde BoStore
  const stores = await prisma.boStore.findMany({ select: { code: true, name: true } });
  const costCentersToCreate = stores.length > 0 ? stores : [
    { code: '000', name: 'Casa Matriz / Oficina Central' },
    { code: '001', name: 'Estación Principal 001' },
  ];

  for (const store of costCentersToCreate) {
    await prisma.costCenter.upsert({
      where: { code: store.code },
      update: {
        name: store.name,
        storeCode: store.code,
        isActive: true,
      },
      create: {
        code: store.code,
        name: store.name,
        storeCode: store.code,
        isActive: true,
      },
    });
  }
  console.log(`[SEED-ACCOUNTING] Centros de costo sincronizados: ${costCentersToCreate.length} centros.`);

  // 3. Crear Periodos Fiscales para el año en curso
  const currentYear = new Date().getFullYear();
  for (let month = 1; month <= 12; month++) {
    await prisma.fiscalPeriod.upsert({
      where: { year_month: { year: currentYear, month } },
      update: {},
      create: {
        year: currentYear,
        month,
        status: 'OPEN',
      },
    });
  }
  console.log(`[SEED-ACCOUNTING] Periodos fiscales del año ${currentYear} inicializados.`);

  // 4. Configurar Mapeos Contables por Defecto
  const defaultMappings = [
    { category: 'PAYMENT_METHOD', sourceIdentifier: 'CASH', accountCode: '1.1.01.01' },
    { category: 'PAYMENT_METHOD', sourceIdentifier: 'CARD', accountCode: '1.1.02.02' },
    { category: 'PAYMENT_METHOD', sourceIdentifier: 'CREDIT', accountCode: '1.1.02.01' },
    { category: 'TAX_ISV', sourceIdentifier: '15', accountCode: '2.1.03.01' },
    { category: 'TAX_ISV', sourceIdentifier: '18', accountCode: '2.1.03.02' },
    { category: 'CASH_SHORTAGE', sourceIdentifier: 'DEFAULT', accountCode: '1.1.02.03' },
    { category: 'CASH_SURPLUS', sourceIdentifier: 'DEFAULT', accountCode: '2.1.03.03' },
    { category: 'FUEL_PRODUCT', sourceIdentifier: 'SUPERIOR', accountCode: '4.1.01.01' },
    { category: 'FUEL_PRODUCT', sourceIdentifier: 'REGULAR', accountCode: '4.1.01.02' },
    { category: 'FUEL_PRODUCT', sourceIdentifier: 'DIESEL', accountCode: '4.1.01.03' },
    { category: 'STORE_PRODUCT', sourceIdentifier: 'DEFAULT', accountCode: '4.1.02.02' },
    { category: 'CUSTOMER_CREDIT', sourceIdentifier: 'DEFAULT', accountCode: '1.1.02.01' },
  ];

  for (const m of defaultMappings) {
    const accId = accountMap.get(m.accountCode);
    if (!accId) continue;

    const existing = await prisma.accountingMapping.findFirst({
      where: {
        category: m.category,
        sourceIdentifier: m.sourceIdentifier,
        costCenterId: null,
      },
    });

    if (existing) {
      await prisma.accountingMapping.update({
        where: { id: existing.id },
        data: { accountId: accId },
      });
    } else {
      await prisma.accountingMapping.create({
        data: {
          category: m.category,
          sourceIdentifier: m.sourceIdentifier,
          accountId: accId,
          costCenterId: null,
        },
      });
    }
  }
  console.log(`[SEED-ACCOUNTING] Mapeos contables por defecto configurados: ${defaultMappings.length} reglas.`);
  console.log('[SEED-ACCOUNTING] Sembrado completado con éxito.');
}

main()
  .catch((e) => {
    console.error('[SEED-ACCOUNTING] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
