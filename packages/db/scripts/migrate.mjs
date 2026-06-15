import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationsDir = path.join(root, "db", "migrations");
const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL_DIRECT or DATABASE_URL is required.");
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : undefined
});

try {
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    console.log(`Running migration ${file}`);
    await pool.query(sql);
  }
} finally {
  await pool.end();
}
