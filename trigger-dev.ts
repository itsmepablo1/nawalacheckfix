import { Queue } from "bullmq";
import Redis from "ioredis";

const redis = new Redis("redis://localhost:6379");
const checkerQueue = new Queue("nawala-check", { connection: redis as any });

async function trigger() {
    console.log("Adding dispatch-all job to checkerQueue...");
    await checkerQueue.add("dispatch-all", { triggered_by: "manual_test" });
    console.log("Job added successfully");
    process.exit(0);
}

trigger().catch(console.error);
