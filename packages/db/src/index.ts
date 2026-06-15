import pg from "pg";
import type { QueryResultRow } from "pg";

const { Pool } = pg;

export type TenantClient = pg.PoolClient;

let pool: pg.Pool | undefined;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.DATABASE_URL_DIRECT;
}

export function getPool(): pg.Pool {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database operations.");
  }

  pool ??= new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : undefined
  });

  return pool;
}

export async function withTenant<T>(tenantId: string, callback: (client: TenantClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function queryWithTenant<T extends QueryResultRow = QueryResultRow>(
  tenantId: string,
  text: string,
  values: unknown[] = []
): Promise<pg.QueryResult<T>> {
  return withTenant(tenantId, (client) => client.query<T>(text, values));
}

export function hasDatabase(): boolean {
  return Boolean(getDatabaseUrl());
}
