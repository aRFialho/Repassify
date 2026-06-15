import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { accepted, ok } from "../http/response.js";

const emptySummary = {
  totalSold: 0,
  grossAmount: 0,
  feeAmount: 0,
  shippingAmount: 0,
  adsAmount: 0,
  expectedNetAmount: 0,
  receivedAmount: 0,
  differenceAmount: 0,
  retainedAmount: 0,
  criticalIssues: 0,
  realMargin: 0,
  marginPercent: 0
};

export async function registerPayoutCenterRoutes(app: FastifyInstance) {
  app.get("/v1/payout-center/summary", async (request) => {
    const context = getRequestContext(request);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT
             COALESCE(sum((components->>'gross')::numeric), 0)::float AS "grossAmount",
             COALESCE(sum((components->>'fee')::numeric), 0)::float AS "feeAmount",
             COALESCE(sum((components->>'shipping')::numeric), 0)::float AS "shippingAmount",
             COALESCE(sum((components->>'ads')::numeric), 0)::float AS "adsAmount",
             COALESCE(sum(expected_amount), 0)::float AS "expectedNetAmount",
             COALESCE(sum(received_amount), 0)::float AS "receivedAmount",
             COALESCE(sum(difference_amount), 0)::float AS "differenceAmount",
             COALESCE(sum(retained_amount), 0)::float AS "retainedAmount",
             COALESCE(sum((components->>'margin')::numeric), 0)::float AS "realMargin"
           FROM payouts`,
          []
        )
      );
      const issues = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT count(*)::int AS count
           FROM reconciliation_issues
           WHERE severity IN ('high', 'critical') AND status <> 'resolved'`,
          []
        )
      );
      const summary = { ...emptySummary, ...result.rows[0], criticalIssues: issues.rows[0]?.count ?? 0 };
      const gross = Number(summary.grossAmount || 0);
      const margin = Number(summary.realMargin || 0);
      return ok({ ...summary, marginPercent: gross > 0 ? (margin / gross) * 100 : 0 });
    }

    return ok(emptySummary);
  });

  app.get("/v1/payout-center/payouts", async (request) => {
    const context = getRequestContext(request);
    const query = z.object({ channel: z.string().optional(), status: z.string().optional() }).parse(request.query);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT payouts.id,
                  payouts.payout_number AS "payoutNumber",
                  COALESCE(channel_accounts.provider, 'Sem canal') AS channel,
                  COALESCE(companies.trade_name, companies.legal_name, 'Sem empresa') AS company,
                  concat(payouts.period_start, ' - ', payouts.period_end) AS period,
                  payouts.expected_amount AS "expectedAmount",
                  payouts.received_amount AS "receivedAmount",
                  payouts.difference_amount AS "differenceAmount",
                  payouts.retained_amount AS "retainedAmount",
                  payouts.status,
                  payouts.components
           FROM payouts
           LEFT JOIN channel_accounts ON channel_accounts.id = payouts.channel_account_id
           LEFT JOIN companies ON companies.id = payouts.company_id
           WHERE ($1::text IS NULL OR channel_accounts.provider = $1)
             AND ($2::text IS NULL OR payouts.status = $2)
           ORDER BY payouts.created_at DESC`,
          [query.channel ?? null, query.status ?? null]
        )
      );
      return ok(result.rows);
    }

    return ok([]);
  });

  app.get("/v1/payout-center/payouts/:id", async (request, reply) => {
    const context = getRequestContext(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(`SELECT * FROM payouts WHERE id = $1`, [params.id])
      );

      if (!result.rows[0]) return reply.code(404).send({ error: "payout_not_found" });
      return ok(result.rows[0]);
    }

    return reply.code(404).send({ error: "payout_not_found" });
  });

  app.post("/v1/payout-center/payouts/:id/reprocess", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return accepted({ payoutId: params.id, jobId: crypto.randomUUID(), auditLog: "payout.reprocess_requested" });
  });

  app.post("/v1/payout-center/payouts/:id/mark-audit", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({ reason: z.string().min(3), severity: z.enum(["low", "medium", "high", "critical"]).default("medium") })
      .parse(request.body);
    return ok({ payoutId: params.id, status: "audited", ...body, auditLog: "payout.audit_marked" });
  });

  app.post("/v1/payout-center/payouts/:id/dispute", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ reason: z.string().min(3), evidenceUrl: z.string().optional() }).parse(request.body);
    return ok({ payoutId: params.id, status: "disputed", ...body, auditLog: "payout.disputed" });
  });

  app.post("/v1/payout-center/periods/:periodId/lock", async (request) => {
    const params = z.object({ periodId: z.string() }).parse(request.params);
    return ok({ periodId: params.periodId, status: "locked", snapshotId: crypto.randomUUID(), auditLog: "period.locked" });
  });
}
