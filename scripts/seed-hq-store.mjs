import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Campos de empresa que la casa matriz (000) posee y que las tiendas heredan. */
const HQ_FIELDS = [
  'titulo',
  'RTN',
  'address',
  'logoUrl',
  'moduleCustomers',
  'printCreditInvoices',
  'SyncMinutes',
  'PresentationMinutes',
  'emisor',
  'moneda',
  'codigoMoneda',
  'telefono',
  'correo',
];

async function main() {
  const existing = await prisma.boStore.findUnique({ where: { code: '000' } });

  if (existing) {
    console.log('[SEED] Casa matriz (000) ya existe. Sin cambios.');
    return;
  }

  console.log('[SEED] Casa matriz (000) no existe. Creándola a partir de la primera tienda...');

  const first = await prisma.boStore.findFirst({
    orderBy: { code: 'asc' },
    where: { code: { not: '000' } },
  });

  const hqData = {
    code: '000',
    name: first?.name?.includes('Matriz') ? first.name : 'Casa Matriz',
    ip: '127.0.0.1',
    isActive: true,
    healthStatus: 'ONLINE',
    isLocalStore: false,
  };

  if (first) {
    for (const field of HQ_FIELDS) {
      const v = first?.[field];
      if (v !== undefined && v !== null && v !== '') {
        hqData[field] = v;
      }
    }
    // Datos informativos de la empresa
    hqData.rtn = first.rtn ?? undefined;
    hqData.emisor = first.emisor ?? undefined;
    hqData.moneda = first.moneda ?? undefined;
    hqData.telefono = first.telefono ?? undefined;
    hqData.correo = first.correo ?? undefined;
    hqData.address = first.address ?? undefined;
    console.log(`[SEED] Copiando campos de empresa desde tienda '${first.code}'...`);
  }

  await prisma.boStore.create({ data: hqData });
  console.log('[SEED] Casa matriz (000) creada con éxito.');
}

main()
  .catch((err) => {
    console.error('[SEED] Error creando la casa matriz (000):', err);
  })
  .finally(() => prisma.$disconnect());