import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import argon2 from "argon2";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    // SECURITY WARNING: Remove this file entirely after running in production once
    try {
        const { username, password } = await request.json();

        if (process.env.NODE_ENV === "production") {
            return NextResponse.json({ error: "Register dev route is disabled in production" }, { status: 403 });
        }

        const prisma = getPrisma();

        const existingAdmin = await prisma.admin.findUnique({
            where: { username },
        });

        if (existingAdmin) {
            return NextResponse.json({ error: "Admin already exists" }, { status: 400 });
        }

        const password_hash = await argon2.hash(password);

        const newAdmin = await prisma.admin.create({
            data: {
                username,
                password_hash,
                role: "SUPER_ADMIN",
            }
        });

        // Seed Providers
        const PROVIDERS = [
            { key: "FIRSTMEDIA", name: "First Media" },
            { key: "INDOSAT", name: "Indosat Ooredoo" },
            { key: "SMARTFREN", name: "Smartfren" },
            { key: "AXIS_XL", name: "Axis & XL Axiata" },
            { key: "INDIHOME", name: "IndiHome (Telkom)" },
            { key: "BIZNET", name: "Biznet Networks" },
            { key: "TELKOMSEL", name: "Telkomsel" },
            { key: "KOMINFO", name: "TrustPositif Kominfo" },
        ];

        for (const p of PROVIDERS) {
            await prisma.provider.upsert({
                where: { key: p.key },
                update: {},
                create: { key: p.key, name: p.name, is_active: true },
            });
        }

        // Seed default settings
        const settings = await prisma.telegramSettings.findFirst();
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
            });
        }

        return NextResponse.json({ success: true, user: { username: newAdmin.username } });
    } catch (error) {
        console.error("Register error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
