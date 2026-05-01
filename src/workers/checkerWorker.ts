import { Worker, Job } from "bullmq";
import { CHECKER_QUEUE_NAME, checkerQueue, telegramQueue } from "../lib/queue";
import { redis } from "../lib/redis";
import { getPrisma } from "../lib/prisma";
import { checkDomain } from "../lib/checker";

const LOCK_KEY = "nawala:check:running";
const LOCK_TTL = 120; // detik

export const checkerWorker = new Worker(
    CHECKER_QUEUE_NAME,
    async (job: Job) => {
        if (job.name === "dispatch-all") {
            const { isManual } = job.data;
            const prisma = getPrisma();

            if (!isManual) {
                const settings = await prisma.telegramSettings.findFirst();
                if (!settings || !settings.auto_check) {
                    // console.log("[Checker] Auto-check is disabled. Skipping scheduled run.");
                    return "Auto-check disabled";
                }
            }

            console.log("[Checker] Dispatching all domains for check. Manual:", !!isManual);

            // ── Lock agar tidak overlap dengan manual trigger ────────────────
            const lockAcquired = await (redis as any).set(LOCK_KEY, "1", "EX", LOCK_TTL, "NX");
            if (!lockAcquired) {
                console.log("[Checker] Auto-check skipped — manual check sedang berjalan.");
                return "Skipped: lock held by manual run";
            }

            const domains = await prisma.domain.findMany({ where: { is_active: true } });
            const providers = await prisma.provider.findMany({ where: { is_active: true } });

            if (domains.length === 0 || providers.length === 0) {
                console.log("[Checker] No active domains or providers to check.");
                return;
            }

            // We group checks by provider or just dispatch individual jobs
            const jobs = [];
            const timestamp = new Date();

            for (const provider of providers) {
                for (const domain of domains) {
                    jobs.push({
                        name: "check-domain",
                        data: {
                            domain_id: domain.id,
                            domain_name: domain.domain,
                            provider_key: provider.key,
                            check_method: provider.check_method || "HTTP",
                            proxy_url: provider.proxy_url,
                            dns_server: provider.dns_server,
                            dns_server_secondary: (provider as any).dns_server_secondary ?? null,
                            apn_host: (provider as any).apn_host ?? null,
                            mmsc_url: (provider as any).mmsc_url ?? null,
                            indiwtf_token: process.env.INDIWTF_API_TOKEN ?? null,
                            timestamp: timestamp.toISOString()
                        }
                    });
                }
            }

            // Enqueue all individual checks
            // In a real high-throughput system you'd use addBulk
            for (const j of jobs) {
                await checkerWorker.rateLimit(10); // Simple concurrency control
                await checkerQueue.add(j.name, j.data, { removeOnComplete: true, removeOnFail: true });
            }

            // Once all are dispatched, we could wait, but for simplicity
            // we'll dispatch a delayed report job, or a "check-completed" job 
            // when the queue drains. A simple approach is adding a report job at the end
            // that runs after a delay, or using BullMQ flows.
            // For this demo, let's just queue the telegram reporter to run after 30 seconds
            await telegramQueue.add("generate-report", { check_timestamp: timestamp.toISOString() }, { delay: 30000 });

            // Release lock — jobs sudah di-queue, worker individual akan menyelesaikannya
            await redis.del(LOCK_KEY);

            return `Dispatched ${jobs.length} checks`;
        }

        if (job.name === "check-domain") {
            const { domain_id, domain_name, provider_key, check_method, proxy_url, dns_server, dns_server_secondary, apn_host, mmsc_url, indiwtf_token, timestamp } = job.data;

            const result = await checkDomain(
                domain_name,
                check_method || "HTTP",
                proxy_url,
                dns_server,
                undefined, // use default timeout
                apn_host,
                mmsc_url,
                dns_server_secondary,
                indiwtf_token ?? process.env.INDIWTF_API_TOKEN,
            );

            // Save to DB
            const prisma = getPrisma();
            await prisma.checkResult.create({
                data: {
                    domain_id,
                    provider_key,
                    status: result.status,
                    http_status: result.http_status,
                    final_url: result.final_url,
                    latency_ms: result.latency_ms,
                    error_code: result.error_code,
                    checked_at: new Date(timestamp)
                }
            });

            return result.status;
        }
    },
    { connection: redis as any, concurrency: 5 }
);

checkerWorker.on("completed", (job) => {
    // console.log(`[Checker] Job ${job.id} completed!`);
});

checkerWorker.on("failed", (job, err) => {
    console.error(`[Checker] Job ${job?.id} failed with ${err.message}`);
});
