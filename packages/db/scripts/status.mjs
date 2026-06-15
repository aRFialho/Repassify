import pg from "pg";

const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL_DIRECT or DATABASE_URL is required.");
}

const pool = new pg.Pool({
  connectionString,
  ssl: /neon\.tech|render\.com|amazonaws\.com|supabase\.co/i.test(connectionString) ? { rejectUnauthorized: false } : undefined
});

try {
  const result = await pool.query(`
    SELECT
      to_regclass('public.users') AS users_table,
      to_regclass('public.schema_migrations') AS migrations_table,
      COALESCE((SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'), 0)::int AS public_tables
  `);

  console.log(JSON.stringify(result.rows[0], null, 2));
} finally {
  await pool.end();
}
