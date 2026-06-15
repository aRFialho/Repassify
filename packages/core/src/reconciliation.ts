import { roundMoney } from "./money.js";
import type { ExpectedReceivable, ReconciliationIssue, ReconciliationMatch, SettlementInput } from "./types.js";

export interface ReconciliationOptions {
  amountTolerance: number;
  dateToleranceDays: number;
}

const defaultOptions: ReconciliationOptions = {
  amountTolerance: 2,
  dateToleranceDays: 4
};

function daysBetween(a: string, b: string): number {
  const first = new Date(`${a}T00:00:00.000Z`).getTime();
  const second = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.abs(first - second) / 86_400_000;
}

function scoreCandidate(expected: ExpectedReceivable, settlement: SettlementInput, options: ReconciliationOptions): number {
  const sameOrder = settlement.orderNumber && settlement.orderNumber === expected.orderNumber;
  const sameChannel = settlement.channel === expected.channel;
  const amountDiff = Math.abs(expected.expectedNetAmount - settlement.netAmount);
  const dateDiff = daysBetween(expected.dueDate, settlement.settlementDate);

  let score = 0;
  if (sameOrder) score += 50;
  if (sameChannel) score += 25;
  if (amountDiff <= options.amountTolerance) score += 20;
  if (dateDiff <= options.dateToleranceDays) score += 5;

  return score;
}

export function reconcileReceivables(
  expected: ExpectedReceivable[],
  settlements: SettlementInput[],
  options: ReconciliationOptions = defaultOptions
): { matches: ReconciliationMatch[]; issues: ReconciliationIssue[] } {
  const usedSettlements = new Set<string>();
  const matches: ReconciliationMatch[] = [];
  const issues: ReconciliationIssue[] = [];

  for (const receivable of expected) {
    const candidates = settlements
      .filter((settlement) => !usedSettlements.has(settlement.id))
      .map((settlement) => ({ settlement, score: scoreCandidate(receivable, settlement, options) }))
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    if (!best || best.score < 40) {
      matches.push({
        expectedId: receivable.saleId,
        score: 0,
        status: "unmatched",
        difference: receivable.expectedNetAmount,
        evidences: [{ label: "reason", value: "No settlement candidate above threshold" }]
      });
      issues.push({
        id: `issue_${receivable.saleId}`,
        issueType: "missing_payout",
        severity: "high",
        amountImpact: receivable.expectedNetAmount,
        status: "open",
        explanation: `Pedido ${receivable.orderNumber} ainda nao possui repasse correspondente.`,
        evidence: [{ label: "expectedNetAmount", value: receivable.expectedNetAmount }]
      });
      continue;
    }

    usedSettlements.add(best.settlement.id);
    const difference = roundMoney(best.settlement.netAmount - receivable.expectedNetAmount);
    const status = Math.abs(difference) <= options.amountTolerance ? "matched" : "partial";

    matches.push({
      expectedId: receivable.saleId,
      settlementId: best.settlement.id,
      score: best.score,
      status,
      difference,
      evidences: [
        { label: "channel", value: receivable.channel },
        { label: "expected", value: receivable.expectedNetAmount },
        { label: "received", value: best.settlement.netAmount },
        { label: "payoutNumber", value: best.settlement.payoutNumber }
      ]
    });

    if (status === "partial") {
      issues.push({
        id: `issue_${receivable.saleId}_${best.settlement.id}`,
        issueType: difference < 0 ? "underpaid_payout" : "overpaid_payout",
        severity: Math.abs(difference) > 500 ? "high" : "medium",
        amountImpact: Math.abs(difference),
        status: "open",
        explanation: `Pedido ${receivable.orderNumber} teve diferenca de repasse de ${difference}.`,
        evidence: [{ label: "difference", value: difference }]
      });
    }
  }

  return { matches, issues };
}
