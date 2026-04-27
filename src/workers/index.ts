import "./checkerWorker";
import "./telegramWorker";
import { checkerQueue } from "../lib/queue";

console.log("🚀 Background Workers started processing queues...");

// Initialize the 5-minute auto check schedule. Duplicates are ignored by BullMQ using jobId.
checkerQueue.add(
    "dispatch-all",
    { isManual: false },
    {
        repeat: { pattern: "*/5 * * * *" },
        jobId: "auto-dispatch-all",
        removeOnComplete: true,
        removeOnFail: true
    }
).catch(err => console.error("Failed to add repeatable job", err));
