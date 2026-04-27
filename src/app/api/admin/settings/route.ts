import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const prisma = getPrisma();
        const settings = await prisma.telegramSettings.findFirst();
        return NextResponse.json(settings || {});
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const prisma = getPrisma();
        const settings = await prisma.telegramSettings.findFirst();

        if (settings) {
            const updated = await prisma.telegramSettings.update({
                where: { id: settings.id },
                data: {
                    bot_token_encrypted: data.bot_token_encrypted,
                    destinations: data.destinations ? JSON.stringify(data.destinations) : "[]",
                    webhook_url: data.webhook_url,
                    mode: data.mode,
                    send_on_change_only: data.send_on_change_only,
                    enabled: data.enabled,
                    auto_check: data.auto_check,
                },
            });
            return NextResponse.json(updated);
        } else {
            const created = await prisma.telegramSettings.create({
                data: {
                    bot_token_encrypted: data.bot_token_encrypted,
                    destinations: data.destinations ? JSON.stringify(data.destinations) : "[]",
                    webhook_url: data.webhook_url,
                    mode: data.mode || "blocked_only",
                    send_on_change_only: data.send_on_change_only ?? true,
                    enabled: data.enabled ?? false,
                    auto_check: data.auto_check ?? false,
                },
            });
            return NextResponse.json(created);
        }
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
