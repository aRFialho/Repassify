import { demoSales, shopeeAuditRule, simulateRule } from "@repassify/core";

async function main() {
  const simulation = simulateRule(shopeeAuditRule, demoSales);
  console.log(
    JSON.stringify({
      worker: "ingestion",
      status: "ready",
      preview: {
        detectedTemplate: "Shopee Settlement v2026",
        rowsSampled: demoSales.length,
        ruleMatches: simulation.matchedCount
      }
    })
  );
}

await main();
