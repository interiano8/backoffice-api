import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const storeCode = process.env.INITIAL_STORE_CODE || '001';
  const existing = await prisma.boStore.findUnique({ where: { code: storeCode } });

  const storeData = {
    code: storeCode,
    name: process.env.INITIAL_STORE_NAME || 'Estación Central 001',
    address: process.env.INITIAL_STORE_ADDRESS || 'Boulevard Principal Km 5, Ciudad',
    ip: process.env.POS_DB_HOST || 'postgres-pos-local',
    dbPort: parseInt(process.env.POS_DB_PORT || '5432', 10),
    dbName: process.env.POS_DB_NAME || 'prisma',
    dbUser: process.env.POS_DB_USER || 'pos_user',
    dbPassword: process.env.POS_DB_PASSWORD || 'pos_secret_password',
    apiUrl: process.env.POS_API_URL || 'http://prisma-pos-backend:5012/api',
    isActive: true,
    healthStatus: 'ONLINE',
  };

  if (existing) {
    console.log(`[SEED] Tienda '${storeCode}' ya existe en Matriz. Actualizando conectividad de red interna...`);
    await prisma.boStore.update({
      where: { code: storeCode },
      data: storeData,
    });
  } else {
    console.log(`[SEED] Registrando tienda inicial '${storeCode}' en Matriz...`);
    await prisma.boStore.create({
      data: storeData,
    });
  }
  console.log(`[SEED] Tienda '${storeCode}' sincronizada con éxito para validación multitienda.`);
}

main()
  .catch((err) => {
    console.error('[SEED] Error registrando tienda inicial:', err);
  })
  .finally(() => prisma.$disconnect());
