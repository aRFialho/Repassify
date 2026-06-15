import { calculateExpectedWithRules, demoSales, reconcileReceivables, shopeeAuditRule } from "@repassify/core";

async function main() {
  const expected = demoSales.map((sale) => calculateExpectedWithRules(sale, [shopeeAuditRule]));
  const result = reconcileReceivables(expected, [
    { id: "stl_1", channel: "Shopee", payoutNumber: "SHP-2026-06-A", settlementDate: "2026-06-21", netAmount: 589.7, orderNumber: "SHP-1001" }
  ]);

  console.log(
    JSON.stringify({
      worker: "reconciliation",
      status: "completed",
      matches: result.matches.length,
      issues: result.issues.length
    })
  );
}

await main();
