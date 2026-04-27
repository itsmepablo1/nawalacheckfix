import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient()

async function main() {
    await prisma.admin.updateMany({
        where: { username: 'admin' },
        data: { role: 'MASTER' }
    });
    console.log("Updated admin account to MASTER");
}

main().catch(console.error).finally(() => prisma.$disconnect());
