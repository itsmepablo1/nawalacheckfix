import { Worker, Job } from "bullmq";
import { TELEGRAM_QUEUE_NAME } from "../lib/queue";
import { redis } from "../lib/redis";
import { getPrisma } from "../lib/prisma";
import { sendTelegramMessage } from "../lib/telegram";
import crypto from "crypto";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format waktu WIB (UTC+7) */
function formatWIB(date: Date): string {
    const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const day   = String(wib.getUTCDate()).padStart(2, "0");
    const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const month = months[wib.getUTCMonth()];
    const year  = wib.getUTCFullYear();
    const hh    = String(wib.getUTCHours()).padStart(2, "0");
    const mm    = String(wib.getUTCMinutes()).padStart(2, "0");
    return `${day} ${month} ${year} — ${hh}:${mm} WIB`;
}

/** Status → emoji dot */
function statusDot(status: string): string {
    if (status === "BLOCKIR")  return "🔴";
    if (status === "AMAN")     return "🟢";
    if (status === "REDIRECT") return "🟡";
    return "⚫"; // TIMEOUT / UNKNOWN
}

// ── Worker ────────────────────────────────────────────────────────────────────

export const telegramWorker = new Worker(
    TELEGRAM_QUEUE_NAME,
    async (job: Job) => {
        if (job.name !== "generate-report") return;

        const { check_timestamp } = job.data;
        console.log(`[Telegram] Generating domain-centric report for cycle: ${check_timestamp}`);

        const prisma = getPrisma();

        const settings = await prisma.telegramSettings.findFirst();
        if (!settings || !settings.enabled) return "Telegram disabled";

        const destinations: string[] = settings.destinations
            ? JSON.parse(settings.destinations)
            : [];
        if (destinations.length === 0) return "No destinations";

        // ── 1. Ambil semua provider aktif ─────────────────────────────────
        const providers = await prisma.provider.findMany({
            where: { is_active: true },
            orderBy: { name: "asc" },
        });

        // ── 2. Ambil semua domain aktif ───────────────────────────────────
        const domains = await prisma.domain.findMany({
            where: { is_active: true },
            orderBy: { domain: "asc" },
        });

        // ── 3. Untuk tiap domain × provider, ambil hasil check terbaru ───
        type ProviderResult = {
            provider_key:  string;
            provider_name: string;
            status:        string;
        };
        type DomainReport = {
            domain:    string;
            results:   ProviderResult[];
            hasBlock:  boolean;
        };

        const domainReports: DomainReport[] = [];

        for (const domain of domains) {
            const results: ProviderResult[] = [];

            for (const provider of providers) {
                const latest = await prisma.checkResult.findFirst({
                    where: {
                        domain_id:    domain.id,
                        provider_key: provider.key,
                    },
                    orderBy: { checked_at: "desc" },
                });

                results.push({
                    provider_key:  provider.key,
                    provider_name: provider.name,
                    status:        latest?.status ?? "UNKNOWN",
                });
            }

            const hasBlock = results.some(r => r.status === "BLOCKIR");
            domainReports.push({ domain: domain.domain, results, hasBlock });
        }

        // ── 4. Pisahkan domain yang terblokir ─────────────────────────────
        const blockedDomains = domainReports.filter(d => d.hasBlock);

        // ── 5. Build hash untuk send_on_change_only ───────────────────────
        const globalBlockHash = crypto
            .createHash("md5")
            .update(blockedDomains.map(d => d.domain).sort().join(","))
            .digest("hex");

        if (settings.send_on_change_only) {
            const log = await prisma.telegramReportsLog.findUnique({
                where: { provider_key: "_GLOBAL_" },
            });
            if (log && log.last_hash_per_provider === globalBlockHash) {
                console.log("[Telegram] No change detected — skipping report.");
                return "No change";
            }
            await prisma.telegramReportsLog.upsert({
                where:  { provider_key: "_GLOBAL_" },
                update: { last_hash_per_provider: globalBlockHash, last_sent_at: new Date() },
                create: { provider_key: "_GLOBAL_", last_hash_per_provider: globalBlockHash, last_sent_at: new Date() },
            });
        }

        // ── 6. Build pesan ────────────────────────────────────────────────
        const timeStr = formatWIB(new Date(check_timestamp));

        let message: string;

        if (blockedDomains.length === 0) {
            // ── TIDAK ADA YANG TERBLOKIR ──────────────────────────────────
            message = [
                `🛡️ <b>NAWALA CHECK REPORT</b>`,
                `📅 ${timeStr}`,
                ``,
                `✅ <b>TIDAK ADA YANG TERBLOKIR</b>`,
                `Semua ${domains.length} domain aman di semua provider.`,
            ].join("\n");

        } else {
            // ── ADA DOMAIN YANG TERBLOKIR ─────────────────────────────────
            const lines: string[] = [
                `🛡️ <b>NAWALA CHECK REPORT</b>`,
                `📅 ${timeStr}`,
                ``,
                `⚠️ <b>${blockedDomains.length} domain terblokir</b> dari ${domains.length} domain terdaftar`,
                ``,
            ];

            for (const dr of blockedDomains) {
                lines.push(`🔴 <b>${dr.domain}</b>`);
                lines.push(`<b>PROVIDER TERBLOKIR :</b>`);

                for (const r of dr.results) {
                    const dot    = statusDot(r.status);
                    const status = r.status === "BLOCKIR"  ? "BLOCKIR"
                                 : r.status === "AMAN"     ? "AMAN"
                                 : r.status === "REDIRECT" ? "REDIRECT"
                                 : "TIMEOUT";
                    lines.push(`${dot} ${r.provider_name.toUpperCase()} — ${status}`);
                }

                lines.push(``); // spasi antar domain
            }

            message = lines.join("\n").trim();
        }

        // ── 7. Kirim ke semua tujuan ──────────────────────────────────────
        for (const dest of destinations) {
            try {
                await sendTelegramMessage(dest, message);
            } catch (err) {
                console.error(`[Telegram] Failed send to ${dest}:`, err);
            }
        }

        console.log(`[Telegram] Report sent. Blocked domains: ${blockedDomains.length}`);
        return `Sent to ${destinations.length} destinations`;
    },
    { connection: redis as any }
);
