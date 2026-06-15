import { calculateExpectedReceivable } from "./money.js";
import type {
  BusinessRule,
  BusinessRuleDefinition,
  ChannelFeeRule,
  RuleAction,
  RuleCondition,
  RuleSimulationResult,
  SaleInput
} from "./types.js";

export const shopeeAuditRule: BusinessRule = {
  id: "rule_shopee_fee_audit",
  name: "Shopee - auditoria de frete alto",
  module: "payout",
  priority: 100,
  scope: { channel: "Shopee" },
  status: "active",
  version: 1,
  definition: {
    conditions: {
      all: [{ field: "channel", operator: "eq", value: "Shopee" }]
    },
    actions: [
      {
        type: "mark_audit",
        when: { field: "shippingAmount", operator: "gt", value: 50 },
        reason: "Frete acima de R$ 50 em pedido Shopee",
        severity: "medium"
      }
    ]
  }
};

export function getFieldValue(record: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, record);
}

export function evaluateCondition(record: Record<string, unknown>, condition: RuleCondition): boolean {
  const actual = getFieldValue(record, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "contains":
      return String(actual ?? "").toLowerCase().includes(String(expected).toLowerCase());
    default:
      return false;
  }
}

export function evaluateRule(record: Record<string, unknown>, definition: BusinessRuleDefinition): boolean {
  const all = definition.conditions.all ?? [];
  const any = definition.conditions.any ?? [];
  const allResult = all.length === 0 || all.every((condition) => evaluateCondition(record, condition));
  const anyResult = any.length === 0 || any.some((condition) => evaluateCondition(record, condition));
  return allResult && anyResult;
}

export function actionsForRecord(record: Record<string, unknown>, rule: BusinessRule): RuleAction[] {
  if (rule.status !== "active" || !evaluateRule(record, rule.definition)) {
    return [];
  }

  return rule.definition.actions.filter((action) => {
    if (!("when" in action) || !action.when) {
      return true;
    }

    return evaluateCondition(record, action.when);
  });
}

export function calculateExpectedWithRules(sale: SaleInput, rules: BusinessRule[], feeRules?: ChannelFeeRule[]) {
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
  const fallbackFeePercent = 0;
  const auditFlags: string[] = [];

  for (const rule of sortedRules) {
    const actions = actionsForRecord(sale as unknown as Record<string, unknown>, rule);
    for (const action of actions) {
      if (action.type === "mark_audit") {
        auditFlags.push(action.reason);
      }
    }
  }

  return calculateExpectedReceivable(sale, fallbackFeePercent, auditFlags, feeRules);
}

export function simulateRule(rule: BusinessRule, records: SaleInput[]): RuleSimulationResult {
  const actions = records
    .map((record) => ({
      targetId: record.id,
      actionsApplied: actionsForRecord(record as unknown as Record<string, unknown>, rule)
    }))
    .filter((result) => result.actionsApplied.length > 0);

  const auditCount = actions.filter((result) => result.actionsApplied.some((action) => action.type === "mark_audit")).length;

  return {
    ruleId: rule.id,
    matchedCount: actions.length,
    totalCount: records.length,
    estimatedImpact: 0,
    auditCount,
    actions
  };
}
