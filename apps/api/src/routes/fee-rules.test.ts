import { describe, expect, it } from "vitest";
import { buildServer } from "../server.js";

describe("channel fee rule routes", () => {
  it("prefers source reported commission from spreadsheet or integration", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/v1/channel-fee-rules/resolve",
      payload: {
        channel: "Shopee",
        amount: 840,
        shippingAmount: 64.9,
        discountAmount: 20,
        reportedMarketplaceFeeAmount: 151.2,
        reportedPercentageFee: 18,
        feeSourceType: "spreadsheet",
        soldAt: "2026-06-21"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.rule).toBeUndefined();
    expect(response.json().data.commissionAmount).toBe(151.2);
    expect(response.json().data.feeSource).toBe("source_reported");
    expect(response.json().data.needsFeeReview).toBe(false);
    await app.close();
  });
});
