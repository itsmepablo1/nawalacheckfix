import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2'

const prisma = new PrismaClient()

const PROVIDERS = [
    { key: "FIRSTMEDIA", name: "First Media" },
    { key: "INDOSAT", name: "Indosat Ooredoo" },
    { key: "SMARTFREN", name: "Smartfren" },
    { key: "AXIS_XL", name: "Axis & XL Axiata" },
    { key: "INDIHOME", name: "IndiHome (Telkom)" },
    { key: "BIZNET", name: "Biznet Networks" },
    { key: "TELKOMSEL", name: "Telkomsel" },
    { key: "KOMINFO", name: "TrustPositif Kominfo" },
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
        update: { role: 'MASTER' },
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
                enabled: false
            }
        })
    }

    console.log(`Seeding finished.`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
