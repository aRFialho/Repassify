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
  ssl: /neon\.tech|render\.com|amazonaws\.com|supabase\.co/i.test(connectionString) ? { rejectUnauthorized: false } : undefined
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const checksum = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sql))).toString("hex");
    const applied = await pool.query("SELECT checksum FROM schema_migrations WHERE filename = $1", [file]);

    if (applied.rowCount && applied.rows[0].checksum === checksum) {
      console.log(`Skipping migration ${file}`);
      continue;
    }

    if (applied.rowCount) {
      throw new Error(`Migration ${file} was already applied with a different checksum.`);
    }

    console.log(`Running migration ${file}`);
    const client = await pool.connect();
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [file, checksum]);
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
