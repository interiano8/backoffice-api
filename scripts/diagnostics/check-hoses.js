const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hoses = await prisma.boHose.findMany({
    where: { storeCode: '012' }
  });
  console.log(JSON.stringify(hoses, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
