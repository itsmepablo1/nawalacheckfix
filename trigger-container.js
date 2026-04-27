const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
const checkerQueue = new Queue('domain-checker-queue', { connection: redis });

async function trigger() {
    console.log("Adding dispatch-all job...");
    await checkerQueue.add("dispatch-all", { check_timestamp: Date.now() }, { removeOnComplete: true, removeOnFail: true });
    console.log("Job added!");
    process.exit(0);
}

trigger().catch(console.error);
