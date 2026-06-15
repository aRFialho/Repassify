import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { getRequestContext } from "../http/context.js";
import { ok } from "../http/response.js";
import { demoState } from "../repositories/demo.js";

export async function registerTenantRoutes(app: FastifyInstance) {
  app.get("/v1/tenants/current", async (request) => {
    const context = getRequestContext(request);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT id, legal_name AS "legalName", trade_name AS "tradeName", plan_code AS "planCode", status, timezone
           FROM tenants
           WHERE id = $1`,
          [context.tenantId]
        )
      );

      return ok(result.rows[0] ?? demoState.tenant, { role: context.role, permissions: context.permissions });
    }

    return ok(demoState.tenant, { role: context.role, permissions: context.permissions });
  });
}
