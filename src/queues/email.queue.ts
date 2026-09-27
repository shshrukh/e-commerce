import { Queue, QueueEvents } from "bullmq";
import { bullmqConnection } from "../config/bullMQ.radis.config.js";

const registerEmailQueue = new Queue("registerEmailQueue", {
    connection: bullmqConnection,
});

const queueEvents = new QueueEvents("registerEmailQueue", {
    connection: bullmqConnection,
});

queueEvents.on("waiting", ({ jobId }) => {
    console.log(`Job ${jobId} is waiting`);
});

queueEvents.on("active", ({ jobId, prev }) => {
    console.log(`Job ${jobId} is active; previous status: ${prev}`)
});

queueEvents.on("completed", ({ jobId, returnvalue }) => {
    console.log(`Job ${jobId} completed; returned: ${returnvalue}`);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
    console.log(`Job ${jobId} failed: ${failedReason}`);
});

export { registerEmailQueue };