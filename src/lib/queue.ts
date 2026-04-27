import { Queue } from "bullmq";
import { redis } from "./redis";

export const CHECKER_QUEUE_NAME = "domain-checker-queue";
export const TELEGRAM_QUEUE_NAME = "telegram-reporter-queue";
export const HEARTBEAT_QUEUE_NAME = "provider-heartbeat-queue";

export const checkerQueue = new Queue(CHECKER_QUEUE_NAME, {
    connection: redis as any,
});

export const telegramQueue = new Queue(TELEGRAM_QUEUE_NAME, {
    connection: redis as any,
});

export const heartbeatQueue = new Queue(HEARTBEAT_QUEUE_NAME, {
    connection: redis as any,
});

export async function triggerScheduledChecks() {
    // We'll queue a master job that gathers domains and dispatches them
    await checkerQueue.add(
        "dispatch-all",
        { timestamp: Date.now() },
        { removeOnComplete: true, removeOnFail: 100 }
    );
}
