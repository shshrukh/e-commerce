import "dotenv/config";
import { Pool, type PoolConfig } from "pg";


const requiredEnv = [
    "DB_USER",
    "DB_PASSWORD",
    "DB_HOST",
    "DB_PORT",
    "DB_DATABASENAME"
] as const;

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`Missing enviroment variables : ${key}`)
    }
}
const dbConfig: PoolConfig = {
    user: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD as string,
    host: process.env.DB_HOST as string,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_DATABASENAME as string,
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
};



const pool = new Pool(dbConfig);

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
});

const connectDB = async (): Promise<void> => {

    try {
        await pool.query("SELECT 1");
        console.log("PostgresSQL is connected successfully ");

    } catch (error) {
        console.error("Failed to connect to the database", error);
        throw error;
    }
};


const closeDB = async (): Promise<void> => {
    try {
        await pool.end();
        console.log("✅ PostgreSQL pool closed");
    } catch (error) {
        console.error("Error while closing PostgreSQL pool", error);
    }
};

process.on("SIGINT", async () => {
    console.log("\nReceived SIGINT");
    await closeDB();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("\nReceived SIGTERM");
    await closeDB();
    process.exit(0);
});

export { connectDB, closeDB , pool };