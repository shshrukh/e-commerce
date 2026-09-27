import { Redis } from "ioredis";

if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is missing");
}

const bullmqConnection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

export { bullmqConnection };