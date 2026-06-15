import { calculateMarketplaceFee, demoChannelFeeRules } from "@repassify/core";
import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { ok } from "../http/response.js";

const feeRuleSchema = z.object({
  channel: z.string().min(2),
  ruleName: z.string().min(3),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  sellerType: z.string().optional(),
  listingType: z.string().optional(),
  chargeBase: z.enum(["product", "product_shipping", "discounted_product"]),
  percentageFee: z.number().min(0).max(100),
  percentageFeeMin: z.number().min(0).max(100).optional(),
  percentageFeeMax: z.number().min(0).max(100).optional(),
  fixedFee: z.number().min(0).default(0),
  minimumFee: z.number().min(0).optional(),
  maximumFee: z.number().min(0).optional(),
  shippingFeePercent: z.number().min(0).max(100).optional(),
  freePeriodDays: z.number().int().min(0).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceUrl: z.string().optional(),
  sourceConfidence: z.enum(["official", "partner", "market", "manual"]),
  ruleOrigin: z.enum(["reference_seed", "seller_contract", "imported_table", "manual_override"]).default("manual_override"),
  notes: z.string().optional(),
  isActive: z.boolean().default(true)
});

const resolveSchema = z.object({
  channel: z.string().min(2),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  sellerType: z.string().optional(),
  listingType: z.string().optional(),
  amount: z.number().min(0),
  shippingAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  reportedMarketplaceFeeAmount: z.number().min(0).optional(),
  reportedPercentageFee: z.number().min(0).max(100).optional(),
  reportedFixedFeeAmount: z.number().min(0).optional(),
  feeSourceType: z.enum(["spreadsheet", "integration", "manual"]).optional(),
  sourceFeePayload: z.record(z.unknown()).optional(),
  soldAt: z.string().optional()
});

function toApiRule(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    channel: String(row.channel_provider),
    ruleName: String(row.rule_name),
    category: row.category as string | undefined,
    subcategory: row.subcategory as string | undefined,
    sellerType: row.seller_type as string | undefined,
    listingType: row.listing_type as string | undefined,
    chargeBase: row.charge_base,
    percentageFee: Number(row.percentage_fee),
    percentageFeeMin: row.percentage_fee_min == null ? undefined : Number(row.percentage_fee_min),
    percentageFeeMax: row.percentage_fee_max == null ? undefined : Number(row.percentage_fee_max),
    fixedFee: Number(row.fixed_fee ?? 0),
    minimumFee: row.minimum_fee == null ? undefined : Number(row.minimum_fee),
    maximumFee: row.maximum_fee == null ? undefined : Number(row.maximum_fee),
    shippingFeePercent: row.shipping_fee_percent == null ? undefined : Number(row.shipping_fee_percent),
    freePeriodDays: row.free_period_days as number | undefined,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to as string | undefined,
    sourceUrl: row.source_url as string | undefined,
    sourceConfidence: row.source_confidence,
    ruleOrigin: row.rule_origin ?? "reference_seed",
    notes: row.notes as string | undefined,
    isActive: Boolean(row.is_active)
  };
}

export async function registerFeeRuleRoutes(app: FastifyInstance) {
  app.get("/v1/channel-fee-rules", async (request) => {
    const context = getRequestContext(request);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT id, channel_provider, rule_name, category, subcategory, seller_type, listing_type,
                  charge_base, percentage_fee, percentage_fee_min, percentage_fee_max, fixed_fee,
                  minimum_fee, maximum_fee, shipping_fee_percent, free_period_days,
                  effective_from, effective_to, source_url, source_confidence, rule_origin, notes, is_active
           FROM channel_fee_rules
           ORDER BY channel_provider, category NULLS FIRST, effective_from DESC`,
          []
        )
      );
      return ok(result.rows.map((row) => toApiRule(row)));
    }

    return ok(demoChannelFeeRules);
  });

  app.post("/v1/channel-fee-rules", async (request, reply) => {
    const context = getRequestContext(request);
    const input = feeRuleSchema.parse(request.body);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `INSERT INTO channel_fee_rules (
             tenant_id, channel_provider, rule_name, category, subcategory, seller_type, listing_type,
             charge_base, percentage_fee, percentage_fee_min, percentage_fee_max, fixed_fee,
             minimum_fee, maximum_fee, shipping_fee_percent, free_period_days,
             effective_from, effective_to, source_url, source_confidence, rule_origin, notes, is_active, created_by
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
           RETURNING id, channel_provider, rule_name, category, subcategory, seller_type, listing_type,
                     charge_base, percentage_fee, percentage_fee_min, percentage_fee_max, fixed_fee,
                     minimum_fee, maximum_fee, shipping_fee_percent, free_period_days,
                     effective_from, effective_to, source_url, source_confidence, rule_origin, notes, is_active`,
          [
            context.tenantId,
            input.channel,
            input.ruleName,
            input.category ?? null,
            input.subcategory ?? null,
            input.sellerType ?? null,
            input.listingType ?? null,
            input.chargeBase,
            input.percentageFee,
            input.percentageFeeMin ?? null,
            input.percentageFeeMax ?? null,
            input.fixedFee,
            input.minimumFee ?? null,
            input.maximumFee ?? null,
            input.shippingFeePercent ?? null,
            input.freePeriodDays ?? null,
            input.effectiveFrom,
            input.effectiveTo ?? null,
            input.sourceUrl ?? null,
            input.sourceConfidence,
            input.ruleOrigin,
            input.notes ?? null,
            input.isActive,
            context.userId
          ]
        )
      );
      return reply.code(201).send(ok(toApiRule(result.rows[0] as Record<string, unknown>)));
    }

    return reply.code(201).send(ok({ id: crypto.randomUUID(), ...input }));
  });

  app.post("/v1/channel-fee-rules/resolve", async (request) => {
    const input = resolveSchema.parse(request.body);
    return ok(calculateMarketplaceFee(input, demoChannelFeeRules));
  });
}
