// @ts-ignore: No declaration file for './app.js'
import { app } from "./app.js";
import { connectDB, closeDB} from "./config/db.js";
import { runMigrations } from "./dataBase/migrations/migrate.js";
import { connectRedis } from "./config/redis.js";

const port = Number(process.env.PORT ?? 3000);


await connectDB();

await connectRedis();

runMigrations();




const server = app.listen(port, () => {
    console.log(`Server running on ${port}`);
});

process.on("SIGINT", async () => {
    console.log("Shutting down...");

    server.close(async () => {
        await closeDB();
        process.exit(0);
    });
});

process.on("SIGTERM", async () => {
    console.log("Shutting down...");

    server.close(async () => {
        await closeDB();
        process.exit(0);
    });
});
