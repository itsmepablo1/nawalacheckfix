import { Worker, Job } from "bullmq";
import { TELEGRAM_QUEUE_NAME } from "../lib/queue";
import { redis } from "../lib/redis";
import { getPrisma } from "../lib/prisma";
import { sendTelegramMessage } from "../lib/telegram";
import crypto from "crypto";

export const telegramWorker = new Worker(
    TELEGRAM_QUEUE_NAME,
    async (job: Job) => {
        if (job.name === "generate-report") {
            const { check_timestamp } = job.data;
            console.log(`[Telegram] Generating report for cycle starting at ${check_timestamp}`);
            const prisma = getPrisma();

            const settings = await prisma.telegramSettings.findFirst();
            if (!settings || !settings.enabled) return "Telegram disabled";

            const destinations: string[] = settings.destinations ? JSON.parse(settings.destinations) : [];
            if (destinations.length === 0) return "No destinations";

            const providers = await prisma.provider.findMany({ where: { is_active: true } });

            let reportMessages: string[] = [];
            let totalBlocked = 0;

            for (const provider of providers) {
                // Get latest check per domain for this provider manually to avoid Prisma distinct issues
                const allRecentProviderChecks = await prisma.checkResult.findMany({
                    where: { provider_key: provider.key },
                    orderBy: { checked_at: 'desc' },
                    include: { domain: true },
                });

                // Deduplicate by domain_id
                const seenDomains = new Set<string>();
                const recentChecks: typeof allRecentProviderChecks = [];
                for (const chk of allRecentProviderChecks) {
                    if (!seenDomains.has(chk.domain_id)) {
                        seenDomains.add(chk.domain_id);
                        recentChecks.push(chk);
                    }
                }

                // Filter for BLOCKED, TIMEOUT, or REDIRECT
                const blockedChecks = recentChecks.filter((c: any) => ["BLOCKIR", "TIMEOUT", "REDIRECT"].includes(c.status));

                if (blockedChecks.length > 0) {
                    totalBlocked += blockedChecks.length;
                    // Generate Hash of blocked domains to detect state change
                    const blockedDomainsList = blockedChecks.map((c: any) => c.domain.domain).sort().join(',');
                    const hash = crypto.createHash('md5').update(blockedDomainsList).digest('hex');

                    let shouldSend = true;
                    if (settings.send_on_change_only) {
                        const log = await prisma.telegramReportsLog.findUnique({ where: { provider_key: provider.key } });
                        if (log && log.last_hash_per_provider === hash) {
                            shouldSend = false; // no change
                        } else {
                            await prisma.telegramReportsLog.upsert({
                                where: { provider_key: provider.key },
                                update: { last_hash_per_provider: hash, last_sent_at: new Date() },
                                create: { provider_key: provider.key, last_hash_per_provider: hash }
                            });
                        }
                    }

                    if (shouldSend) {
                        const timestampStr = new Date(check_timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                        let msg = `<b>${provider.name.toUpperCase()}</b> (${timestampStr})\n\n`;
                        for (const check of blockedChecks) {
                            msg += `Domain : ${check.domain.domain}\n`;
                            msg += `Kegunaan : ${check.domain.group_name || '-'}\n`;
                            msg += `Status : ⛔️ ${check.status} ⛔️\n\n`;
                        }
                        reportMessages.push(msg);
                    }

                } else {
                    // If no blocked domains, update hash to empty string
                    if (settings.send_on_change_only) {
                        const log = await prisma.telegramReportsLog.findUnique({ where: { provider_key: provider.key } });
                        if (log && log.last_hash_per_provider !== "NONE") {
                            await prisma.telegramReportsLog.update({
                                where: { provider_key: provider.key },
                                data: { last_hash_per_provider: "NONE", last_sent_at: new Date() }
                            });
                            reportMessages.push(`<b>${provider.name.toUpperCase()}</b>\nTIDAK ADA DOMAIN YANG TERBLOKIR`);
                        }
                    }
                }
            }

            // If full mode or just need to send 'TIDAK ADA DOMAIN YANG TERBLOKIR' if absolutely 0 blocked across all.
            // Behavior: If no blocked domains found in the latest cycle FOR ALL:
            if (totalBlocked === 0 && !settings.send_on_change_only) {
                reportMessages = ["TIDAK ADA DOMAIN YANG TERBLOKIR"];
            } else if (totalBlocked === 0 && reportMessages.length === 0) {
                // It means it's change only, and there were no changes. We might want to skip sending anything.
            }

            // Send the messages
            for (const dest of destinations) {
                for (const msg of reportMessages) {
                    await sendTelegramMessage(dest, msg);
                }
            }

            return `Sent ${reportMessages.length} messages`;
        }
    },
    { connection: redis as any }
);
