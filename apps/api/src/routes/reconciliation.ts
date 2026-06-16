import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { accepted, ok } from "../http/response.js";

export async function registerReconciliationRoutes(app: FastifyInstance) {
  app.post("/v1/reconciliation-runs", async (request, reply) => {
    const context = getRequestContext(request);
    const body = z
      .object({ periodStart: z.string(), periodEnd: z.string(), strategy: z.string().default("deterministic_v1") })
      .parse(request.body);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `INSERT INTO reconciliation_runs (tenant_id, period_start, period_end, status, strategy, created_by)
           VALUES ($1, $2, $3, 'queued', $4, $5)
           RETURNING id, period_start AS "periodStart", period_end AS "periodEnd", status, strategy, created_at AS "createdAt"`,
          [context.tenantId, body.periodStart, body.periodEnd, body.strategy, context.userId]
        )
      );
      return reply.code(201).send(ok(result.rows[0]));
    }

    return reply.code(201).send(ok({ id: crypto.randomUUID(), status: "queued", ...body }));
  });

  app.get("/v1/reconciliation-runs/:id", async (request) => {
    const context = getRequestContext(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT id, period_start AS "periodStart", period_end AS "periodEnd", status, strategy, stats,
                  created_at AS "createdAt", completed_at AS "completedAt"
           FROM reconciliation_runs
           WHERE id = $1`,
          [params.id]
        )
      );
      return ok(result.rows[0] ?? { id: params.id, status: "not_found", stats: {} });
    }

    return ok({ id: params.id, status: "not_found", stats: {} });
  });

  app.get("/v1/reconciliation-runs/:id/matches", async (request) => {
    const context = getRequestContext(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT id, expected_id AS "expectedId", settlement_id AS "settlementId",
                  bank_transaction_id AS "bankTransactionId", score, status, evidences, created_at AS "createdAt"
           FROM reconciliation_matches
           WHERE run_id = $1
           ORDER BY created_at DESC`,
          [params.id]
        )
      );
      return ok(result.rows);
    }

    return ok([]);
  });

  app.get("/v1/issues", async (request) => {
    const context = getRequestContext(request);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT id, issue_type AS "issueType", severity, amount_impact AS "amountImpact",
                  status, explanation, evidence, created_at AS "createdAt", updated_at AS "updatedAt"
           FROM reconciliation_issues
           ORDER BY created_at DESC`,
          []
        )
      );
      return ok(result.rows);
    }

    return ok([]);
  });

  app.patch("/v1/issues/:id", async (request) => {
    const context = getRequestContext(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ status: z.string(), resolutionNote: z.string().optional() }).parse(request.body);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `UPDATE reconciliation_issues
           SET status = $2, updated_at = now()
           WHERE id = $1
           RETURNING id, issue_type AS "issueType", status, updated_at AS "updatedAt"`,
          [params.id, body.status]
        )
      );
      return ok(result.rows[0] ?? { id: params.id, ...body });
    }

    return ok({ id: params.id, ...body, auditLog: "issue.updated" });
  });

  app.get("/v1/reports/dre", async (request) => {
    const context = getRequestContext(request);
    const query = z.object({ periodStart: z.string().optional(), periodEnd: z.string().optional() }).parse(request.query);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT
             COALESCE(sum((components->>'gross')::numeric), 0)::float AS revenue,
             COALESCE(sum((components->>'fee')::numeric), 0)::float * -1 AS fees,
             COALESCE(sum((components->>'shipping')::numeric), 0)::float * -1 AS shipping,
             COALESCE(sum((components->>'ads')::numeric), 0)::float * -1 AS ads,
             COALESCE(sum((components->>'refund')::numeric), 0)::float * -1 AS refunds,
             COALESCE(sum((components->>'margin')::numeric), 0)::float AS "grossMargin"
           FROM payouts
           WHERE ($1::date IS NULL OR period_end >= $1::date)
             AND ($2::date IS NULL OR period_start <= $2::date)`,
          [query.periodStart ?? null, query.periodEnd ?? null]
        )
      );
      const row = result.rows[0] ?? {};
      const revenue = Number(row.revenue ?? 0);
      const grossMargin = Number(row.grossMargin ?? 0);
      return ok({ period: "current", ...row, marginPercent: revenue > 0 ? (grossMargin / revenue) * 100 : 0 });
    }

    return ok({ period: "current", revenue: 0, fees: 0, shipping: 0, ads: 0, refunds: 0, grossMargin: 0, marginPercent: 0 });
  });

  app.get("/v1/reports/cashflow", async (request) => {
    const context = getRequestContext(request);
    const query = z.object({ periodStart: z.string().optional(), periodEnd: z.string().optional() }).parse(request.query);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT
             COALESCE(sum(received_amount), 0)::float AS realized,
             COALESCE(sum(expected_amount) FILTER (WHERE status <> 'received'), 0)::float AS projected,
             COALESCE(sum(retained_amount), 0)::float AS retained,
             COALESCE(sum(expected_amount - received_amount), 0)::float AS "openReceivables"
           FROM payouts
           WHERE ($1::date IS NULL OR period_end >= $1::date)
             AND ($2::date IS NULL OR period_start <= $2::date)`,
          [query.periodStart ?? null, query.periodEnd ?? null]
        )
      );
      return ok({ period: "current", ...(result.rows[0] ?? {}) });
    }

    return ok({ period: "current", realized: 0, projected: 0, retained: 0, openReceivables: 0 });
  });

  app.post("/v1/exports/erp", async () => accepted({ exportId: crypto.randomUUID(), format: "csv", status: "queued" }));

  app.post("/v1/ai/explain-issue", async (request) => {
    const body = z.object({ issueId: z.string() }).parse(request.body);
    return ok({
      issueId: body.issueId,
      explanation: "Sem dados suficientes para explicacao automatica. Importe planilhas ou sincronize canais primeiro.",
      confidence: 0,
      safeActions: ["importar_planilha", "sincronizar_canal"],
      requiresConfirmationFor: []
    });
  });
}
