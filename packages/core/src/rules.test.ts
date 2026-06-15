import { describe, expect, it } from "vitest";
import { demoSales } from "./demo-data.js";
import { demoChannelFeeRules } from "./fees.js";
import { calculateExpectedWithRules, shopeeAuditRule, simulateRule } from "./rules.js";

describe("Shopee fixture rule", () => {
  it("uses channel_fee_rules for commission and business rules for audit", () => {
    const sale = demoSales[0]!;
    const expected = calculateExpectedWithRules(sale, [shopeeAuditRule], demoChannelFeeRules);

    expect(expected.components.fee).toBe(151.2);
    expect(expected.feeRuleId).toBeUndefined();
    expect(expected.feeCalculationSource).toBe("source_reported");
    expect(expected.needsFeeReview).toBe(false);
    expect(expected.auditFlags).toContain("Frete acima de R$ 50 em pedido Shopee");
  });

  it("simulates impact before activation", () => {
    const simulation = simulateRule(shopeeAuditRule, demoSales);

    expect(simulation.matchedCount).toBe(1);
    expect(simulation.auditCount).toBe(1);
    expect(simulation.estimatedImpact).toBe(0);
  });
});
