import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { ok } from "../http/response.js";

const channelSchema = z.object({
  provider: z.string().min(2),
  displayName: z.string().min(2),
  externalAccountId: z.string().optional(),
  companyId: z.string().uuid().optional(),
  status: z.enum(["active", "paused", "error"]).default("active")
});

const demoChannels = [
  { id: "ch_shopee", provider: "Shopee", displayName: "Shopee Oficial", externalAccountId: "SHP-001", status: "active" },
  { id: "ch_ml", provider: "Mercado Livre", displayName: "Mercado Livre Full", externalAccountId: "MLB-928", status: "active" },
  { id: "ch_amazon", provider: "Amazon", displayName: "Amazon Brasil", externalAccountId: "AMZ-BR", status: "paused" }
];

export async function registerChannelRoutes(app: FastifyInstance) {
  app.get("/v1/channels", async (request) => {
    const context = getRequestContext(request);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT id, provider, display_name AS "displayName", external_account_id AS "externalAccountId",
                  account_type AS "accountType", status, settings, created_at AS "createdAt"
           FROM channel_accounts
           ORDER BY created_at DESC`,
          []
        )
      );

      return ok(result.rows);
    }

    return ok(demoChannels);
  });

  app.post("/v1/channels", async (request, reply) => {
    const context = getRequestContext(request);
    const input = channelSchema.parse(request.body);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `INSERT INTO channel_accounts (tenant_id, company_id, provider, external_account_id, display_name, status, settings)
           VALUES ($1, $2, $3, $4, $5, $6, '{"connected_by": "manual"}'::jsonb)
           ON CONFLICT (tenant_id, provider, external_account_id) DO UPDATE
             SET display_name = EXCLUDED.display_name,
                 status = EXCLUDED.status,
                 updated_at = now()
           RETURNING id, provider, display_name AS "displayName", external_account_id AS "externalAccountId", status`,
          [
            context.tenantId,
            input.companyId ?? null,
            input.provider,
            input.externalAccountId ?? input.provider.toLowerCase(),
            input.displayName,
            input.status
          ]
        )
      );

      return reply.code(201).send(ok(result.rows[0]));
    }

    return reply.code(201).send(ok({ id: crypto.randomUUID(), ...input }));
  });

  app.patch("/v1/channels/:id/status", async (request) => {
    const context = getRequestContext(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ status: z.enum(["active", "paused", "error"]) }).parse(request.body);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `UPDATE channel_accounts
           SET status = $2, updated_at = now()
           WHERE id = $1
           RETURNING id, provider, display_name AS "displayName", external_account_id AS "externalAccountId", status`,
          [params.id, body.status]
        )
      );

      return ok(result.rows[0] ?? { id: params.id, status: body.status });
    }

    return ok({ id: params.id, status: body.status, auditLog: "channel.status_changed" });
  });
}
