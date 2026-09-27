
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const headers = await prisma.boSaleHeader.findMany({
        where: {
            totalAmount: 95.34
        }
    });
    console.log('BoSaleHeader by Amount 95.34:', JSON.stringify(headers, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
