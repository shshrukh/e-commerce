import "dotenv/config";
import { createClient, type RedisClientType } from "redis";

const requiredEnv = [
    "REDIS_URL",
    "REDIS_PASSWORD"
] as const;

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`Missing environment variable: ${key}`);
    }
}

const redisClient: RedisClientType = createClient({
    url: process.env.REDIS_URL as string,
    password: process.env.REDIS_PASSWORD as string

});

redisClient.on("error", (error) => {
    console.error("Redis client error:", error);
});

const connectRedis = async (): Promise<void> => {
    try {
        await redisClient.connect();
        console.log("Redis connected successfully");
    } catch (error) {
        console.error("Failed to connect to Redis", error);
        throw error;
    }
};

const closeRedis = async (): Promise<void> => {
    try {
        await redisClient.disconnect();
        console.log("✅ Redis connection closed");
    } catch (error) {
        console.error("Error while closing Redis connection", error);
    }
};

export { redisClient, connectRedis, closeRedis };
