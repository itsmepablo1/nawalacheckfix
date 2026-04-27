import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { checkDomain } from "@/lib/checker";
import { getSession } from "@/lib/auth";
import { sendCheckReport } from "@/lib/telegramReport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const session = await getSession(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const prisma = getPrisma();

        const [domains, providers] = await Promise.all([
            prisma.domain.findMany({ where: { is_active: true }, select: { id: true, domain: true } }),
            prisma.provider.findMany({ where: { is_active: true } }),
        ]);

        if (domains.length === 0) {
            return NextResponse.json({ success: false, message: "Tidak ada domain aktif untuk dicek." });
        }
        if (providers.length === 0) {
            return NextResponse.json({ success: false, message: "Tidak ada provider aktif untuk dicek." });
        }

        const timestamp = new Date();
        let completed = 0;
        let errors = 0;
        const BATCH_SIZE = 10;

        // Collect results per provider for Telegram report
        // Map: providerKey → array of domain results
        const providerResults: Map<string, Array<{ domain: string; status: any; latency_ms: number | null }>> = new Map();
        for (const p of providers) providerResults.set(p.key, []);

        const jobs: Array<() => Promise<void>> = [];

        for (const provider of providers) {
            for (const domain of domains) {
                jobs.push(async () => {
                    try {
                        const result = await checkDomain(
                            domain.domain,
                            (provider.check_method as "HTTP" | "DNS") || "HTTP",
                            provider.proxy_url,
                            provider.dns_server
                        );

                        await prisma.checkResult.create({
                            data: {
                                domain_id:    domain.id,
                                provider_key: provider.key,
                                status:       result.status,
                                http_status:  result.http_status,
                                final_url:    result.final_url,
                                latency_ms:   result.latency_ms,
                                error_code:   result.error_code,
                                checked_at:   timestamp,
                            },
                        });

                        // Collect for Telegram
                        providerResults.get(provider.key)?.push({
                            domain:     domain.domain,
                            status:     result.status,
                            latency_ms: result.latency_ms,
                        });

                        completed++;
                    } catch (err: any) {
                        console.error(`Check failed for ${domain.domain} / ${provider.key}:`, err.message);
                        errors++;
                    }
                });
            }
        }

        // Run in batches
        for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
            const batch = jobs.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(batch.map(fn => fn()));
        }

        // Update provider heartbeat
        await Promise.allSettled(
            providers.map(p =>
                prisma.providerHeartbeat.upsert({
                    where:  { provider_id: p.id },
                    update: { status: "RUNNING", last_seen: timestamp },
                    create: { provider_id: p.id, status: "RUNNING", last_seen: timestamp },
                })
            )
        );

        // Send Telegram reports (fire-and-forget style, don't block response)
        const telegramReports = providers.map(p => ({
            providerName: p.name,
            providerKey:  p.key,
            checkMethod:  p.check_method || "HTTP",
            dnsServer:    p.dns_server,
            results:      providerResults.get(p.key) || [],
            checkedAt:    timestamp,
        }));

        // Run Telegram send async (don't await — don't block the API response)
        sendCheckReport(telegramReports).then(({ sent, skipped }) => {
            console.log(`[Telegram] Sent ${sent} report(s), skipped ${skipped}.`);
        }).catch(err => {
            console.error("[Telegram] Report send error:", err);
        });

        return NextResponse.json({
            success: true,
            message: `Selesai! ${completed} dari ${domains.length * providers.length} cek berhasil.${errors > 0 ? ` (${errors} gagal)` : ""}`,
            stats: { total: domains.length * providers.length, completed, errors, domains: domains.length, providers: providers.length },
        });

    } catch (error: any) {
        console.error("Trigger checks failed:", error);
        return NextResponse.json({ error: "Gagal menjalankan cek.", details: error.message }, { status: 500 });
    }
}
