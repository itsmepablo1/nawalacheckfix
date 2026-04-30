import { Worker, Job } from "bullmq";
import { TELEGRAM_QUEUE_NAME } from "../lib/queue";
import { redis } from "../lib/redis";
import { sendDomainCentricReport } from "../lib/telegramReport";

export const telegramWorker = new Worker(
    TELEGRAM_QUEUE_NAME,
    async (job: Job) => {
        if (job.name !== "generate-report") return;

        const { check_timestamp } = job.data;
        console.log(`[Telegram] Generating report for cycle: ${check_timestamp}`);

        const result = await sendDomainCentricReport(new Date(check_timestamp));
        console.log(`[Telegram] ${result}`);
        return result;
    },
    { connection: redis as any }
);
