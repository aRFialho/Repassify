import { demoSales, shopeeAuditRule, simulateRule } from "@repassify/core";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
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
  app.get("/v1/rules", async () => ok([shopeeAuditRule]));

  app.post("/v1/rules", async (request, reply) => {
    const input = ruleSchema.parse(request.body);
    return reply.code(201).send(
      ok({
        id: crypto.randomUUID(),
        status: "draft",
        version: 1,
        ...input
      })
    );
  });

  app.post("/v1/rules/:id/simulate", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const rule = params.id === shopeeAuditRule.id ? shopeeAuditRule : shopeeAuditRule;
    return ok(simulateRule(rule, demoSales));
  });

  app.post("/v1/rules/:id/activate", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return ok({ id: params.id, status: "active", version: 1, auditLog: "rule.activated" });
  });

  app.post("/v1/rules/:id/pause", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return ok({ id: params.id, status: "paused", auditLog: "rule.paused" });
  });

  app.get("/v1/rules/:id/executions", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return ok([
      {
        id: crypto.randomUUID(),
        ruleId: params.id,
        targetType: "sale",
        targetId: "sale_1001",
        matched: true,
        actionsApplied: shopeeAuditRule.definition.actions,
        executedAt: "2026-06-15T14:20:00Z"
      }
    ]);
  });
}
