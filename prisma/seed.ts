import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import argon2 from 'argon2';

// Prisma 7: wajib pakai adapter karena schema tidak punya url
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PROVIDERS = [
    { key: "FIRSTMEDIA", name: "First Media" },
    { key: "INDOSAT", name: "Indosat Ooredoo" },
    { key: "SMARTFREN", name: "Smartfren" },
    { key: "AXIS_XL", name: "Axis & XL Axiata" },
    { key: "INDIHOME", name: "IndiHome (Telkom)" },
    { key: "BIZNET", name: "Biznet Networks" },
    { key: "TELKOMSEL", name: "Telkomsel" },
    { key: "KOMINFO", name: "TrustPositif Kominfo" },
    { key: "MYREPUBLIC", name: "MyRepublic" },
]

async function main() {
    console.log(`Start seeding ...`)

    // 1. Seed Providers
    for (const p of PROVIDERS) {
        await prisma.provider.upsert({
            where: { key: p.key },
            update: {},
            create: { key: p.key, name: p.name, is_active: true },
        })
    }

    // 2. Seed Super Admin
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const hashedPassword = await argon2.hash(adminPassword)

    await prisma.admin.upsert({
        where: { username: 'admin' },
        update: { role: 'MASTER', password_hash: hashedPassword }, // selalu update hash
        create: {
            username: 'admin',
            role: 'MASTER',
            password_hash: hashedPassword,
        },
    })

    // 3. Setup Default Telegram Setting
    const settings = await prisma.telegramSettings.findFirst()
    if (!settings) {
        await prisma.telegramSettings.create({
            data: {
                bot_token_encrypted: "",
                destinations: "[]",
                webhook_url: "",
                mode: "blocked_only",
                send_on_change_only: true,
                enabled: false,
                check_interval_minutes: 5,
            }
        })
    }

    console.log(`Seeding finished.`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        await pool.end()
        process.exit(1)
    })
