import { demoDashboardSummary, demoPayouts } from "@repassify/core";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { accepted, ok } from "../http/response.js";
import { demoState } from "../repositories/demo.js";

export async function registerPayoutCenterRoutes(app: FastifyInstance) {
  app.get("/v1/payout-center/summary", async (request) => {
    const context = getRequestContext(request);
    return ok(demoDashboardSummary, {
      tenantId: context.tenantId,
      filters: {
        period: "2026-06",
        company: "Loja Repassify",
        bankAccount: "Banco Neon ****-2390"
      }
    });
  });

  app.get("/v1/payout-center/payouts", async (request) => {
    const query = z
      .object({
        channel: z.string().optional(),
        status: z.string().optional()
      })
      .parse(request.query);

    const rows = demoPayouts.filter((payout) => {
      const channelMatch = query.channel ? payout.channel === query.channel : true;
      const statusMatch = query.status ? payout.status === query.status : true;
      return channelMatch && statusMatch;
    });

    return ok(rows);
  });

  app.get("/v1/payout-center/payouts/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const payout = demoState.payouts.find((row) => row.id === params.id);

    if (!payout) {
      return reply.code(404).send({ error: "payout_not_found" });
    }

    return ok({
      ...payout,
      calculationTrace: [
        { label: "Valor bruto", amount: payout.components.gross },
        { label: "Taxas e comissoes", amount: -payout.components.fee },
        { label: "Frete", amount: -payout.components.shipping },
        { label: "Ads", amount: -payout.components.ads },
        { label: "Estornos", amount: -payout.components.refund },
        { label: "Liquido esperado", amount: payout.expectedAmount },
        { label: "Recebido", amount: payout.receivedAmount },
        { label: "Diferenca", amount: payout.differenceAmount }
      ],
      issues: demoState.issues.filter((issue) => issue.issueType.includes("shipping") || payout.severity === issue.severity)
    });
  });

  app.post("/v1/payout-center/payouts/:id/reprocess", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return accepted({ payoutId: params.id, jobId: crypto.randomUUID(), auditLog: "payout.reprocess_requested" });
  });

  app.post("/v1/payout-center/payouts/:id/mark-audit", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ reason: z.string().min(3), severity: z.enum(["low", "medium", "high", "critical"]).default("medium") }).parse(request.body);
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
