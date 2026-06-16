import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { ok } from "../http/response.js";
import {
  buildShopeeAuthorizationUrl,
  encryptShopeeCredential,
  exchangeShopeeCode,
  getShopeeTokenExpiresAt,
  isShopeeConfigured,
  shopeePaths,
  verifyShopeeState
} from "../integrations/shopee.js";

const channelSchema = z.object({
  provider: z.string().min(2),
  displayName: z.string().min(2),
  externalAccountId: z.string().optional(),
  companyId: z.string().uuid().optional(),
  status: z.enum(["active", "paused", "error"]).default("active")
});

const channelProviders = [
  "Shopee",
  "Mercado Livre",
  "Amazon",
  "Magalu",
  "Shein",
  "Americanas",
  "Casas Bahia",
  "TikTok Shop",
  "Carrefour",
  "MadeiraMadeira",
  "Netshoes",
  "AliExpress"
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

    return ok([]);
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

  app.get("/v1/channels/providers", async () =>
    ok(
      channelProviders.map((provider) => ({
        provider,
        authMode: provider === "Shopee" || provider === "Mercado Livre" ? "oauth" : "manual_credentials",
        supportsOrderSync: true,
        supportsSettlementSync: true
      }))
    )
  );

  app.get("/v1/channels/:provider/auth/start", async (request) => {
    const context = getRequestContext(request);
    const params = z.object({ provider: z.string().min(2) }).parse(request.params);

    if (params.provider.toLowerCase() === "shopee") {
      const authorizationUrl = buildShopeeAuthorizationUrl({
        tenantId: context.tenantId,
        userId: context.userId
      });

      return ok({
        provider: "Shopee",
        configured: Boolean(authorizationUrl),
        authorizationUrl,
        callbackUrl:
          process.env.SHOPEE_REDIRECT_URI ??
          `${process.env.API_PUBLIC_URL ?? "http://localhost:3333"}/v1/channels/shopee/auth/callback`,
        requiredEnv: ["SHOPEE_PARTNER_ID", "SHOPEE_PARTNER_KEY", "SHOPEE_REDIRECT_URI"],
        message: authorizationUrl
          ? "Abra a URL de autorizacao da Shopee para vincular a loja."
          : "Configure SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY e SHOPEE_REDIRECT_URI para iniciar autenticacao."
      });
    }

    return ok({
      provider: params.provider,
      configured: false,
      authorizationUrl: null,
      message: "Credenciais oficiais do canal ainda nao configuradas para iniciar autenticacao."
    });
  });

  app.get("/v1/channels/shopee/auth/callback", async (request, reply) => {
    const query = z
      .object({
        code: z.string().optional(),
        shop_id: z.string().optional(),
        main_account_id: z.string().optional(),
        state: z.string().min(10).optional(),
        error: z.string().optional(),
        message: z.string().optional()
      })
      .parse(request.query);

    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    const failureRedirect = new URL(webOrigin);
    failureRedirect.searchParams.set("channel", "shopee");
    failureRedirect.searchParams.set("status", "error");

    if (query.error || !query.code || !query.state) {
      failureRedirect.searchParams.set("message", query.message ?? query.error ?? "Autorizacao Shopee incompleta.");
      return reply.redirect(failureRedirect.toString());
    }

    const state = verifyShopeeState(query.state);
    if (!state) {
      failureRedirect.searchParams.set("message", "Estado OAuth Shopee invalido ou expirado.");
      return reply.redirect(failureRedirect.toString());
    }

    try {
      const tokenPayload = await exchangeShopeeCode({
        code: query.code,
        shopId: query.shop_id,
        mainAccountId: query.main_account_id
      });

      const shopIds = Array.isArray(tokenPayload.shop_id_list)
        ? tokenPayload.shop_id_list.map(String)
        : query.shop_id
          ? [query.shop_id]
          : [];
      const merchantIds = Array.isArray(tokenPayload.merchant_id_list)
        ? tokenPayload.merchant_id_list.map(String)
        : query.main_account_id
          ? [query.main_account_id]
          : [];
      const externalIds = shopIds.length ? shopIds : merchantIds;

      if (hasDatabase()) {
        await withTenant(state.tenantId, async (client) => {
          for (const externalId of externalIds) {
            const account = await client.query<{ id: string }>(
              `INSERT INTO channel_accounts (
                 tenant_id, provider, external_account_id, display_name, status, settings
               )
               VALUES ($1, 'Shopee', $2, $3, 'active', $4::jsonb)
               ON CONFLICT (tenant_id, provider, external_account_id) DO UPDATE
                 SET display_name = EXCLUDED.display_name,
                     status = 'active',
                     settings = channel_accounts.settings || EXCLUDED.settings,
                     updated_at = now()
               RETURNING id`,
              [
                state.tenantId,
                externalId,
                shopIds.length ? `Shopee Loja ${externalId}` : `Shopee Merchant ${externalId}`,
                JSON.stringify({
                  connected_by: "oauth",
                  auth_provider: "shopee_open_platform",
                  shop_id: shopIds.includes(externalId) ? externalId : null,
                  merchant_id: merchantIds.includes(externalId) ? externalId : null,
                  shop_id_list: shopIds,
                  merchant_id_list: merchantIds,
                  last_auth_at: new Date().toISOString(),
                  api_paths: shopeePaths
                })
              ]
            );

            const accountId = account.rows[0]?.id;
            if (!accountId) {
              throw new Error("Nao foi possivel criar conta Shopee.");
            }

            await client.query("DELETE FROM integration_credentials WHERE channel_account_id = $1 AND credential_type = 'shopee_oauth'", [
              accountId
            ]);
            await client.query(
              `INSERT INTO integration_credentials (
                 tenant_id, channel_account_id, credential_type, encrypted_payload, expires_at, rotated_at
               )
               VALUES ($1, $2, 'shopee_oauth', $3, $4, now())`,
              [
                state.tenantId,
                accountId,
                encryptShopeeCredential({
                  access_token: tokenPayload.access_token,
                  refresh_token: tokenPayload.refresh_token,
                  expire_in: tokenPayload.expire_in,
                  shop_id: shopIds.includes(externalId) ? externalId : null,
                  merchant_id: merchantIds.includes(externalId) ? externalId : null
                }),
                getShopeeTokenExpiresAt(tokenPayload.expire_in)
              ]
            );
          }
        });
      }

      const successRedirect = new URL(webOrigin);
      successRedirect.searchParams.set("channel", "shopee");
      successRedirect.searchParams.set("status", "connected");
      successRedirect.searchParams.set("accounts", String(externalIds.length));
      return reply.redirect(successRedirect.toString());
    } catch (error) {
      failureRedirect.searchParams.set(
        "message",
        error instanceof Error ? error.message : "Falha ao autenticar Shopee."
      );
      return reply.redirect(failureRedirect.toString());
    }
  });

  app.post("/v1/channels/:provider/sync", async (request) => {
    const params = z.object({ provider: z.string().min(2) }).parse(request.params);
    if (params.provider.toLowerCase() === "shopee") {
      return ok({
        provider: "Shopee",
        status: isShopeeConfigured() ? "ready_for_sync_worker" : "not_configured",
        importedOrders: 0,
        importedSettlements: 0,
        message: isShopeeConfigured()
          ? "Autenticacao pronta. A proxima etapa e ativar o worker de pedidos, escrow e devolucoes."
          : "Configure as credenciais Shopee antes de sincronizar."
      });
    }

    return ok({
      provider: params.provider,
      status: "not_configured",
      importedOrders: 0,
      importedSettlements: 0,
      message: "Sincronizacao aguardando credenciais reais do marketplace."
    });
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
