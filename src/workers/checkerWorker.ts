import { Worker, Job } from "bullmq";
import { CHECKER_QUEUE_NAME } from "../lib/queue";
import { redis } from "../lib/redis";
import { getPrisma } from "../lib/prisma";
import { checkDomain } from "../lib/checker";
import { sendDomainCentricReport } from "../lib/telegramReport";

const LOCK_KEY = "nawala:check:running";
const LOCK_TTL = 300; // 5 menit max

// ── Shared check runner — dipakai oleh auto-check & manual trigger ────────────
export async function runAllChecks(source: "auto" | "manual"): Promise<string> {
    const prisma = getPrisma();
    const indiwtfToken = process.env.INDIWTF_API_TOKEN ?? undefined;

    // Acquire lock
    const lockAcquired = await (redis as any).set(LOCK_KEY, source, "EX", LOCK_TTL, "NX");
    if (!lockAcquired) {
        const holder = await redis.get(LOCK_KEY);
        console.log(`[Checker] Skipped (${source}) — lock held by: ${holder}`);
        return `Skipped: lock held by ${holder}`;
    }

    try {
        const [domains, providers] = await Promise.all([
            prisma.domain.findMany({ where: { is_active: true } }),
            prisma.provider.findMany({ where: { is_active: true } }),
        ]);

        if (domains.length === 0 || providers.length === 0) {
            return "No active domains/providers";
        }

        // Satu timestamp untuk seluruh sesi — penting agar hasil tidak tercampur
        const timestamp  = new Date();
        const BATCH_SIZE = 5;
        let completed    = 0;
        let errors       = 0;

        const tasks: Array<() => Promise<void>> = [];

        for (const provider of providers) {
            for (const domain of domains) {
                tasks.push(async () => {
                    try {
                        const result = await checkDomain(
                            domain.domain,
                            (provider.check_method as any) || "HTTP",
                            provider.proxy_url,
                            provider.dns_server,
                            undefined,
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
                                checked_at:   timestamp, // SAMA untuk semua dalam satu sesi
                            },
                        });
                        completed++;
                    } catch (err: any) {
                        console.error(`[Checker] ${domain.domain}/${provider.key}: ${err.message}`);
                        errors++;
                    }
                });
            }
        }

        // Run berurutan per batch — selesai semua SEBELUM lock dilepas
        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            await Promise.allSettled(tasks.slice(i, i + BATCH_SIZE).map(fn => fn()));
        }

        // Update heartbeat
        await Promise.allSettled(
            providers.map(p =>
                prisma.providerHeartbeat.upsert({
                    where:  { provider_id: p.id },
                    update: { status: "RUNNING", last_seen: timestamp },
                    create: { provider_id: p.id, status: "RUNNING", last_seen: timestamp },
                })
            )
        );

        // Kirim Telegram report LANGSUNG — tidak lewat queue agar pasti terkirim
        try {
            const reportResult = await sendDomainCentricReport(timestamp);
            console.log(`[Telegram] ${reportResult}`);
        } catch (err) {
            console.error("[Telegram] Report error:", err);
        }

        console.log(`[Checker] Done (${source}): ${completed} ok, ${errors} err`);
        return `${completed} checks done, ${errors} errors`;

    } finally {
        // SELALU lepas lock setelah semua check selesai
        await redis.del(LOCK_KEY);
    }
}

// ── BullMQ Worker — hanya untuk auto-check terjadwal ─────────────────────────
export const checkerWorker = new Worker(
    CHECKER_QUEUE_NAME,
    async (job: Job) => {
        if (job.name === "dispatch-all") {
            const { isManual } = job.data;
            const prisma = getPrisma();

            if (!isManual) {
                const settings = await prisma.telegramSettings.findFirst();
                if (!settings || !settings.auto_check) return "Auto-check disabled";
            }

            console.log("[Checker] dispatch-all triggered. Manual:", !!isManual);
            return await runAllChecks(isManual ? "manual" : "auto");
        }
    },
    { connection: redis as any, concurrency: 1 } // concurrency 1 — tidak paralel
);

checkerWorker.on("failed", (job, err) => {
    console.error(`[Checker] Job ${job?.id} failed: ${err.message}`);
});
