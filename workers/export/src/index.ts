import { demoPayouts } from "@repassify/core";

function toCsv(rows: typeof demoPayouts): string {
  const header = ["payoutNumber", "channel", "expectedAmount", "receivedAmount", "differenceAmount"].join(",");
  const body = rows
    .map((row) => [row.payoutNumber, row.channel, row.expectedAmount, row.receivedAmount, row.differenceAmount].join(","))
    .join("\n");
  return `${header}\n${body}`;
}

async function main() {
  console.log(
    JSON.stringify({
      worker: "export",
      status: "ready",
      format: "csv",
      bytes: Buffer.byteLength(toCsv(demoPayouts))
    })
  );
}

await main();
