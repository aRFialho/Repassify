import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { ok } from "../http/response.js";
import { demoState } from "../repositories/demo.js";

const companySchema = z.object({
  legalName: z.string().min(3),
  tradeName: z.string().optional(),
  cnpj: z.string().regex(/^\d{14}$/),
  taxRegime: z.string().optional(),
  financeOwnerName: z.string().optional(),
  financeOwnerEmail: z.string().email().optional()
});

export function validateCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj)) return false;
  const digits = cnpj.split("").map(Number);
  const calc = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + weight * (digits[index] ?? 0), 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return calc(12) === digits[12] && calc(13) === digits[13];
}

export async function registerCompanyRoutes(app: FastifyInstance) {
  app.get("/v1/companies", async (request) => {
    const context = getRequestContext(request);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT id, legal_name AS "legalName", trade_name AS "tradeName", cnpj, tax_regime AS "taxRegime",
                  timezone, currency, finance_owner_name AS "financeOwnerName",
                  finance_owner_email AS "financeOwnerEmail", status
           FROM companies
           ORDER BY created_at DESC`,
          []
        )
      );
      return ok(result.rows);
    }

    return ok([demoState.company]);
  });

  app.post("/v1/companies", async (request, reply) => {
    const context = getRequestContext(request);
    const input = companySchema.parse(request.body);
    const cnpjIsValid = validateCnpj(input.cnpj);

    if (!cnpjIsValid) {
      return reply.code(422).send({ error: "invalid_cnpj", message: "CNPJ invalido." });
    }

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `INSERT INTO companies (tenant_id, legal_name, trade_name, cnpj, tax_regime, finance_owner_name, finance_owner_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, legal_name AS "legalName", trade_name AS "tradeName", cnpj, status`,
          [
            context.tenantId,
            input.legalName,
            input.tradeName ?? null,
            input.cnpj,
            input.taxRegime ?? null,
            input.financeOwnerName ?? null,
            input.financeOwnerEmail ?? null
          ]
        )
      );
      return reply.code(201).send(ok(result.rows[0]));
    }

    return reply.code(201).send(ok({ id: crypto.randomUUID(), ...input, status: "active" }));
  });

  app.patch("/v1/companies/:id", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = companySchema.partial().parse(request.body);
    return ok({ id: params.id, ...input, auditLog: "company.updated" });
  });
}
