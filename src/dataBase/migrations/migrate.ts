import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../../config/db.js";

export async function runMigrations() {
    // Create migration table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            executed_at TIMESTAMP DEFAULT NOW()
        );
    `);

    const migrationsPath = path.join(
        process.cwd(),
        "src",
        "dataBase",
        "migrations"
    );

    const files = (await fs.readdir(migrationsPath))
        .filter((file) => file.endsWith(".sql"))
        .sort();

    for (const file of files) {

        const alreadyExecuted = await pool.query(
            `SELECT 1 FROM migrations WHERE name = $1`,
            [file]
        );

        if (alreadyExecuted.rowCount) {
            console.log(`✓ ${file} already executed`);
            continue;
        }

        console.log(`Running ${file}`);

        const sql = await fs.readFile(
            path.join(migrationsPath, file),
            "utf8"
        );

        await pool.query(sql);

        await pool.query(
            `INSERT INTO migrations(name) VALUES($1)`,
            [file]
        );

        console.log(`✓ ${file} completed`);
    }
}