import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { ok } from "../http/response.js";

const ruleSchema = z.object({
  name: z.string().min(3),
  module: z.string().min(2),
  priority: z.number().int().default(100),
  scope: z.record(z.unknown()).default({}),
  definition: z.object({
    conditions: z.object({
      all: z.array(z.object({ field: z.string(), operator: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) })).optional(),
      any: z.array(z.object({ field: z.string(), operator: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) })).optional()
    }),
    actions: z.array(z.record(z.unknown()))
  })
});

export async function registerRulesRoutes(app: FastifyInstance) {
  app.get("/v1/rules", async (request) => {
    const context = getRequestContext(request);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT business_rules.id,
                  business_rules.name,
                  rule_sets.module,
                  business_rules.priority,
                  business_rules.scope,
                  business_rules.definition,
                  business_rules.status,
                  business_rules.current_version AS "currentVersion",
                  business_rules.created_at AS "createdAt",
                  business_rules.updated_at AS "updatedAt"
           FROM business_rules
           JOIN rule_sets ON rule_sets.id = business_rules.rule_set_id
           ORDER BY business_rules.created_at DESC`,
          []
        )
      );
      return ok(result.rows);
    }

    return ok([]);
  });

  app.post("/v1/rules", async (request, reply) => {
    const context = getRequestContext(request);
    const input = ruleSchema.parse(request.body);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, async (client) => {
        const ruleSet = await client.query(
          `INSERT INTO rule_sets (tenant_id, name, module, description, created_by)
           VALUES ($1, $2, $3, 'Criado pelo cockpit web', $4)
           ON CONFLICT (tenant_id, name) DO UPDATE SET is_active = true
           RETURNING id`,
          [context.tenantId, `${input.module} default`, input.module, context.userId]
        );

        return client.query(
          `INSERT INTO business_rules (tenant_id, rule_set_id, name, priority, scope, definition, status, created_by)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'draft', $7)
           RETURNING id, name, priority, scope, definition, status, current_version AS "currentVersion"`,
          [
            context.tenantId,
            ruleSet.rows[0].id,
            input.name,
            input.priority,
            JSON.stringify(input.scope),
            JSON.stringify(input.definition),
            context.userId
          ]
        );
      });
      return reply.code(201).send(ok({ ...result.rows[0], module: input.module }));
    }

    return reply.code(201).send(ok({ id: crypto.randomUUID(), status: "draft", currentVersion: 1, ...input }));
  });

  app.post("/v1/rules/:id/simulate", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return ok([{ ruleId: params.id, matched: 0, inspected: 0, actionsApplied: [] }]);
  });

  app.post("/v1/rules/:id/activate", async (request) => {
    const context = getRequestContext(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `UPDATE business_rules SET status = 'active', updated_at = now()
           WHERE id = $1
           RETURNING id, status, current_version AS "currentVersion"`,
          [params.id]
        )
      );
      return ok(result.rows[0] ?? { id: params.id, status: "active" });
    }

    return ok({ id: params.id, status: "active", version: 1, auditLog: "rule.activated" });
  });

  app.post("/v1/rules/:id/pause", async (request) => {
    const context = getRequestContext(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(`UPDATE business_rules SET status = 'paused', updated_at = now() WHERE id = $1 RETURNING id, status`, [params.id])
      );
      return ok(result.rows[0] ?? { id: params.id, status: "paused" });
    }

    return ok({ id: params.id, status: "paused", auditLog: "rule.paused" });
  });

  app.get("/v1/rules/:id/executions", async (request) => {
    const context = getRequestContext(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT id, rule_id AS "ruleId", target_type AS "targetType", target_id AS "targetId",
                  matched, actions_applied AS "actionsApplied", executed_at AS "executedAt"
           FROM rule_execution_logs
           WHERE rule_id = $1
           ORDER BY executed_at DESC`,
          [params.id]
        )
      );
      return ok(result.rows);
    }

    return ok([]);
  });
}
