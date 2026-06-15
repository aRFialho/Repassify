import { calculateExpectedWithRules, demoSales, reconcileReceivables, shopeeAuditRule } from "@repassify/core";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { accepted, ok } from "../http/response.js";
import { demoState } from "../repositories/demo.js";

export async function registerReconciliationRoutes(app: FastifyInstance) {
  app.post("/v1/reconciliation-runs", async (request, reply) => {
    const body = z.object({ periodStart: z.string(), periodEnd: z.string(), strategy: z.string().default("deterministic_v1") }).parse(request.body);
    return reply.code(201).send(ok({ id: crypto.randomUUID(), status: "queued", ...body }));
  });

  app.get("/v1/reconciliation-runs/:id", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return ok({
      id: params.id,
      status: "completed",
      stats: { matched: 1284, partial: 34, unmatched: 18, amountAtRisk: 12491.5 }
    });
  });

  app.get("/v1/reconciliation-runs/:id/matches", async () => {
    const expected = demoSales.map((sale) => calculateExpectedWithRules(sale, [shopeeAuditRule]));
    const result = reconcileReceivables(expected, [
      { id: "stl_1", channel: "Shopee", payoutNumber: "SHP-2026-06-A", settlementDate: "2026-06-21", netAmount: 589.7, orderNumber: "SHP-1001" },
      { id: "stl_2", channel: "Mercado Livre", payoutNumber: "ML-2026-06-A", settlementDate: "2026-06-22", netAmount: 1061.1, orderNumber: "ML-4104" }
    ]);
    return ok(result.matches);
  });

  app.get("/v1/issues", async () => ok(demoState.issues));

  app.patch("/v1/issues/:id", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ status: z.string(), resolutionNote: z.string().optional() }).parse(request.body);
    return ok({ id: params.id, ...body, auditLog: "issue.updated" });
  });

  app.get("/v1/reports/dre", async () =>
    ok({
      period: "2026-06",
      revenue: 680740,
      fees: -91970,
      shipping: -27280,
      ads: -6358.3,
      refunds: -4080,
      grossMargin: 142631.3,
      marginPercent: 21.1
    })
  );

  app.get("/v1/reports/cashflow", async () =>
    ok({
      period: "2026-06",
      realized: 552120.5,
      projected: 87340.2,
      retained: 3340,
      openReceivables: 40820.9
    })
  );

  app.post("/v1/exports/erp", async () => accepted({ exportId: crypto.randomUUID(), format: "csv", status: "queued" }));

  app.post("/v1/ai/explain-issue", async (request) => {
    const body = z.object({ issueId: z.string() }).parse(request.body);
    const issue = demoState.issues.find((item) => item.id === body.issueId) ?? demoState.issues[0];
    return ok({
      issueId: body.issueId,
      explanation: issue?.explanation ?? "Divergencia sem dados suficientes.",
      confidence: 0.87,
      safeActions: ["abrir_calculo", "marcar_auditoria", "criar_ticket"],
      requiresConfirmationFor: ["contestar", "fechar_periodo", "exportar_erp"]
    });
  });
}
