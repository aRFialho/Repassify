import bcrypt from "bcryptjs";
import pg from "pg";

const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
const adminEmail = process.env.REPASSIFY_ADMIN_EMAIL ?? "admin@repassify.com";
const adminPassword = process.env.REPASSIFY_ADMIN_PASSWORD;
const adminName = process.env.REPASSIFY_ADMIN_NAME ?? "Admin Master";
const tenantName = process.env.REPASSIFY_TENANT_NAME ?? "Repassify Tecnologia Ltda.";

if (!connectionString) {
  throw new Error("DATABASE_URL_DIRECT or DATABASE_URL is required.");
}

if (!adminPassword) {
  throw new Error("REPASSIFY_ADMIN_PASSWORD is required.");
}

const pool = new pg.Pool({
  connectionString,
  ssl: /neon\.tech|render\.com|amazonaws\.com|supabase\.co/i.test(connectionString) ? { rejectUnauthorized: false } : undefined
});

try {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tenantResult = await client.query(
      `
        INSERT INTO tenants (legal_name, trade_name, plan_code, status, settings)
        VALUES ($1, 'Repassify', 'enterprise', 'active', '{"is_master": true}'::jsonb)
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      [tenantName]
    );

    const tenantId =
      tenantResult.rows[0]?.id ??
      (
        await client.query(
          "SELECT id FROM tenants WHERE settings->>'is_master' = 'true' ORDER BY created_at ASC LIMIT 1"
        )
      ).rows[0]?.id;

    if (!tenantId) {
      throw new Error("Unable to create or locate master tenant.");
    }

    const userResult = await client.query(
      `
        INSERT INTO users (email, full_name, status)
        VALUES ($1, $2, 'active')
        ON CONFLICT (email) DO UPDATE
          SET full_name = EXCLUDED.full_name,
              status = 'active',
              updated_at = now()
        RETURNING id
      `,
      [adminEmail, adminName]
    );

    const userId = userResult.rows[0].id;

    await client.query(
      `
        INSERT INTO user_identities (user_id, provider, provider_subject, email, email_verified, password_hash)
        VALUES ($1, 'password', $2::text, $2::citext, true, $3)
        ON CONFLICT (user_id, provider) DO UPDATE
          SET provider_subject = EXCLUDED.provider_subject,
              email = EXCLUDED.email,
              email_verified = true,
              password_hash = EXCLUDED.password_hash
      `,
      [userId, adminEmail, passwordHash]
    );

    await client.query(
      `
        INSERT INTO tenant_memberships (tenant_id, user_id, role, permissions, status)
        VALUES ($1, $2, 'owner', '{"master_admin": true}'::jsonb, 'active')
        ON CONFLICT (tenant_id, user_id) DO UPDATE
          SET role = 'owner',
              permissions = '{"master_admin": true}'::jsonb,
              status = 'active'
      `,
      [tenantId, userId]
    );

    await client.query("COMMIT");
    console.log(`Admin master ready: ${adminEmail}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
