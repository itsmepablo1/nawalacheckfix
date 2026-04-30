import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { checkDomain } from "@/lib/checker";
import { getSession } from "@/lib/auth";
import { sendDomainCentricReport } from "@/lib/telegramReport";

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

        const timestamp   = new Date();
        let completed     = 0;
        let errors        = 0;
        const BATCH_SIZE  = 10;
        const indiwtfToken = process.env.INDIWTF_API_TOKEN ?? undefined;

        const jobs: Array<() => Promise<void>> = [];

        for (const provider of providers) {
            for (const domain of domains) {
                jobs.push(async () => {
                    try {
                        const result = await checkDomain(
                            domain.domain,
                            (provider.check_method as any) || "HTTP",
                            provider.proxy_url,
                            provider.dns_server,
                            undefined,                              // default timeout
                            (provider as any).apn_host ?? null,
                            (provider as any).mmsc_url ?? null,
                            (provider as any).dns_server_secondary ?? null,
                            indiwtfToken,
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

        // Kirim laporan Telegram dengan format baru (domain-centric, async)
        sendDomainCentricReport(timestamp).then(result => {
            console.log(`[Telegram] Report result: ${result}`);
        }).catch(err => {
            console.error("[Telegram] Report error:", err);
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
