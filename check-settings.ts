import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
    const settings = await prisma.telegramSettings.findFirst();
    console.log("Telegram Settings:", settings);
    const providers = await prisma.provider.findMany();
    console.log("Providers count:", providers.length);
    const domains = await prisma.domain.findMany();
    console.log("Domains count:", domains.length);
    const checks = await prisma.checkResult.count();
    console.log("Total Checks:", checks);
}
run();
