import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const prisma = getPrisma();

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Get total domains
        const totalDomains = await prisma.domain.count({ where: { is_active: true } });

        // Get checks performed today
        const checkedToday = await prisma.checkResult.count({
            where: { checked_at: { gte: startOfDay } }
        });

        // Get currently blocked domains (unique domains that have a BLOCKIR status in their latest check per provider)
        // A simpler metric: Total number of blocked records today, or just domains that have at least one block
        const currentlyBlockedCount = await prisma.checkResult.count({
            where: {
                status: { in: ["BLOCKIR", "TIMEOUT", "REDIRECT"] } // Consider these as blocked indicating issues
            }
        });

        // Get Domains with their recent checks for the domain status table
        const domainsList = await prisma.domain.findMany({
            where: { is_active: true },
            orderBy: { createdAt: "desc" },
            include: {
                checks: {
                    orderBy: { checked_at: "desc" },
                    take: 20 // Get enough recent checks to cover all providers
                }
            }
        });

        // Get Provider Status
        const providersDb = await prisma.provider.findMany({
            orderBy: { name: "asc" },
            include: { heartbeat: true }
        });

        const providers = providersDb.map((p: any) => ({
            key: p.key,
            name: p.name,
            status: p.heartbeat?.status ?? "DOWN",
            is_active: p.is_active,
            proxy_url: p.proxy_url ?? null,
        }));

        return NextResponse.json({
            stats: {
                totalDomains,
                checkedToday,
                currentlyBlocked: currentlyBlockedCount
            },
            domains: domainsList.map((d: any) => ({
                id: d.id,
                domain: d.domain,
                checks: d.checks.map((c: any) => ({
                    provider_key: c.provider_key,
                    status: c.status,
                    checked_at: c.checked_at
                }))
            })),
            providers: providers
        });

    } catch (error) {
        console.error("Dashboard stats error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
