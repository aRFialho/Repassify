import { describe, expect, it } from "vitest";
import { demoChannelFeeRules, resolveChannelFeeRule } from "./fees.js";

describe("channel fee rules", () => {
  it("uses source reported fees before any reference table", () => {
    const resolution = resolveChannelFeeRule(
      {
        channel: "Shopee",
        amount: 840,
        shippingAmount: 64.9,
        discountAmount: 20,
        reportedMarketplaceFeeAmount: 151.2,
        reportedPercentageFee: 18,
        feeSourceType: "spreadsheet",
        soldAt: "2026-06-21"
      },
      demoChannelFeeRules
    );

    expect(resolution.rule).toBeUndefined();
    expect(resolution.commissionAmount).toBe(151.2);
    expect(resolution.feeSource).toBe("source_reported");
    expect(resolution.needsFeeReview).toBe(false);
  });

  it("uses channel reference only as estimate and marks review", () => {
    const resolution = resolveChannelFeeRule(
      {
        channel: "Shopee",
        amount: 840,
        shippingAmount: 64.9,
        discountAmount: 20,
        soldAt: "2026-06-21"
      },
      demoChannelFeeRules
    );

    expect(resolution.rule?.id).toBe("fee_shopee_default_2026");
    expect(resolution.commissionAmount).toBe(164);
    expect(resolution.feeSource).toBe("reference_estimate");
    expect(resolution.needsFeeReview).toBe(true);
    expect(resolution.reviewReasons).toContain("reference_seed_used");
    expect(resolution.reviewReasons).toContain("default_channel_fee_rule_used");
  });

  it("does not invent a commission when channel has no rule", () => {
    const resolution = resolveChannelFeeRule(
      {
        channel: "Canal Novo",
        amount: 100,
        shippingAmount: 0,
        discountAmount: 0
      },
      demoChannelFeeRules
    );

    expect(resolution.rule).toBeUndefined();
    expect(resolution.commissionAmount).toBe(0);
    expect(resolution.feeSource).toBe("fallback_estimate");
    expect(resolution.needsFeeReview).toBe(true);
    expect(resolution.reviewReasons).toContain("missing_channel_fee_rule");
  });
});
