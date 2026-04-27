import { getPrisma } from "./prisma";
import { sendTelegramMessage } from "./telegram";

type DomainResult = {
    domain: string;
    status: "AMAN" | "BLOCKIR" | "REDIRECT" | "TIMEOUT";
    latency_ms?: number | null;
};

type CheckReportInput = {
    providerName: string;
    providerKey: string;
    checkMethod: string;
    dnsServer?: string | null;
    results: DomainResult[];
    checkedAt: Date;
};

/**
 * Format waktu WIB (UTC+7)
 */
function formatWIB(date: Date): string {
    const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const day = wib.getUTCDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const month = months[wib.getUTCMonth()];
    const year = wib.getUTCFullYear();
    const hh = String(wib.getUTCHours()).padStart(2, "0");
    const mm = String(wib.getUTCMinutes()).padStart(2, "0");
    return `${day} ${month} ${year} — ${hh}:${mm} WIB`;
}

/**
 * Build Telegram HTML message sesuai template.
 * Format:
 * 🛡️ NAWALA CHECK [GROUP]
 * 📅 26 Apr 2026 — 14:36 WIB
 * 🔍 Checking by trustpositif.komdigi.go.id
 *
 * 🇮🇩 5 domain | 🟢 3 clean | 🔴 2 blocked | ⚫ 0 down
 *
 * 🟢 dualima.jnt777link.com — CLEAN (95%)
 * 🔴 link14.aksesjnt777.com — BLOCKED
 * ...
 */
export function buildTelegramReport(report: CheckReportInput, mode: "full" | "blocked_only"): string {
    const { providerName, checkMethod, dnsServer, results, checkedAt } = report;

    const clean   = results.filter(r => r.status === "AMAN");
    const blocked = results.filter(r => r.status === "BLOCKIR");
    const down    = results.filter(r => r.status === "TIMEOUT" || r.status === "REDIRECT");
    const total   = results.length;

    // Header
    const timeStr = formatWIB(checkedAt);
    const checkingBy = checkMethod === "DNS" && dnsServer
        ? `DNS: ${dnsServer}`
        : "trustpositif.komdigi.go.id";

    let msg = "";
    msg += `🛡️ <b>NAWALA CHECK ${providerName.toUpperCase()}</b>\n`;
    msg += `📅 ${timeStr}\n`;
    msg += `🔍 Checking by ${checkingBy}\n`;
    msg += `\n`;
    msg += `🇮🇩 <b>${total} domain</b> | 🟢 ${clean.length} clean | 🔴 ${blocked.length} blocked | ⚫ ${down.length} down\n`;
    msg += `\n`;

    // Domain list
    const domainsToShow = mode === "full" ? results : blocked.concat(down);

    if (domainsToShow.length === 0) {
        msg += `✅ Semua domain aman, tidak ada yang terblokir.\n`;
    } else {
        for (const r of domainsToShow) {
            if (r.status === "AMAN") {
                const pct = r.latency_ms ? ` (${Math.min(99, Math.round((1 - r.latency_ms / 3000) * 100))}%)` : "";
                msg += `🟢 ${r.domain} — <b>CLEAN</b>${pct}\n`;
            } else if (r.status === "BLOCKIR") {
                msg += `🔴 ${r.domain} — <b>BLOCKED</b>\n`;
            } else if (r.status === "REDIRECT") {
                msg += `🟡 ${r.domain} — <b>REDIRECT</b>\n`;
            } else {
                msg += `⚫ ${r.domain} — <b>DOWN</b>\n`;
            }
        }
    }

    return msg.trim();
}

/**
 * Kirim laporan cek ke semua chat Telegram yang dikonfigurasi.
 * Dipanggil setelah trigger check selesai.
 */
export async function sendCheckReport(reports: CheckReportInput[]): Promise<{ sent: number; skipped: number }> {
    const prisma = getPrisma();
    const settings = await prisma.telegramSettings.findFirst();

    if (!settings || !settings.enabled || !settings.bot_token_encrypted) {
        console.log("Telegram not configured/enabled — skipping report.");
        return { sent: 0, skipped: reports.length };
    }

    let destinations: string[] = [];
    try {
        destinations = JSON.parse(settings.destinations || "[]");
    } catch {
        destinations = [];
    }

    if (destinations.length === 0) {
        console.log("No Telegram destinations configured — skipping report.");
        return { sent: 0, skipped: reports.length };
    }

    const mode = (settings.mode as "full" | "blocked_only") || "blocked_only";
    let sent = 0;

    for (const report of reports) {
        // Check if we should skip due to "send_on_change_only"
        if (settings.send_on_change_only) {
            const blockedNow   = report.results.filter(r => r.status === "BLOCKIR").map(r => r.domain).sort().join(",");
            const existingLog  = await prisma.telegramReportsLog.findUnique({ where: { provider_key: report.providerKey } });
            const lastHash     = existingLog?.last_hash_per_provider || "";

            if (lastHash === blockedNow && blockedNow !== "") {
                console.log(`[${report.providerKey}] No change in blocked domains — skipping Telegram report.`);
                continue;
            }

            // Update hash
            await prisma.telegramReportsLog.upsert({
                where:  { provider_key: report.providerKey },
                update: { last_hash_per_provider: blockedNow, last_sent_at: new Date() },
                create: { provider_key: report.providerKey, last_hash_per_provider: blockedNow, last_sent_at: new Date() },
            });
        }

        const message = buildTelegramReport(report, mode);

        for (const chatId of destinations) {
            try {
                await sendTelegramMessage(chatId, message);
                sent++;
            } catch (err) {
                console.error(`Failed to send to ${chatId}:`, err);
            }
        }
    }

    return { sent, skipped: reports.length - sent };
}
