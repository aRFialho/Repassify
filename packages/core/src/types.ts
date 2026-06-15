export type CurrencyCode = "BRL" | "USD" | "EUR";

export type Severity = "low" | "medium" | "high" | "critical";

export type PayoutStatus =
  | "expected"
  | "received"
  | "partially_received"
  | "divergent"
  | "retained"
  | "audited"
  | "disputed"
  | "resolved"
  | "exported"
  | "locked";

export type IssueStatus = "open" | "in_review" | "contested" | "resolved" | "accepted_loss" | "ignored";

export type ChargeBase = "product" | "product_shipping" | "discounted_product";

export type FeeSourceConfidence = "official" | "partner" | "market" | "manual";

export type FeeRuleOrigin = "reference_seed" | "seller_contract" | "imported_table" | "manual_override";

export type FeeCalculationSource = "source_reported" | "contract_rule" | "reference_estimate" | "fallback_estimate";

export interface TenantContext {
  tenantId: string;
  userId?: string;
  role?: string;
  permissions?: string[];
}

export interface MoneyBreakdown {
  gross: number;
  fee: number;
  commission: number;
  percentageCommission?: number;
  fixedFee?: number;
  minimumFeeAdjustment?: number;
  maximumFeeAdjustment?: number;
  shipping: number;
  discount: number;
  ads: number;
  campaign?: number;
  anticipation?: number;
  refund: number;
  subsidy: number;
  tax: number;
  informedTax?: number;
}

export interface SaleInput {
  id: string;
  channel: string;
  category?: string;
  subcategory?: string;
  sellerType?: string;
  listingType?: string;
  orderNumber: string;
  grossAmount: number;
  shippingAmount: number;
  discountAmount: number;
  adsAmount: number;
  campaignAmount?: number;
  anticipationAmount?: number;
  informedTaxAmount?: number;
  reportedMarketplaceFeeAmount?: number;
  reportedPercentageFee?: number;
  reportedFixedFeeAmount?: number;
  feeSourceType?: "spreadsheet" | "integration" | "manual";
  sourceFeePayload?: Record<string, unknown>;
  refundAmount: number;
  costAmount: number;
  soldAt?: string;
  expectedPayoutDate: string;
}

export interface ExpectedReceivable {
  saleId: string;
  orderNumber: string;
  channel: string;
  dueDate: string;
  expectedNetAmount: number;
  marginAmount: number;
  marginPercent: number;
  components: MoneyBreakdown;
  auditFlags: string[];
  needsFeeReview?: boolean;
  feeReviewReasons?: string[];
  feeRuleId?: string;
  feeRuleName?: string;
  feeSourceConfidence?: FeeSourceConfidence;
  feeCalculationSource?: FeeCalculationSource;
  sourceFeePayload?: Record<string, unknown>;
}

export interface SettlementInput {
  id: string;
  channel: string;
  payoutNumber: string;
  settlementDate: string;
  netAmount: number;
  orderNumber?: string;
}

export interface ReconciliationEvidence {
  label: string;
  value: string | number | boolean;
}

export interface ReconciliationMatch {
  expectedId: string;
  settlementId?: string;
  score: number;
  status: "matched" | "partial" | "unmatched";
  difference: number;
  evidences: ReconciliationEvidence[];
}

export interface ReconciliationIssue {
  id: string;
  issueType: string;
  severity: Severity;
  amountImpact: number;
  status: IssueStatus;
  explanation: string;
  evidence: ReconciliationEvidence[];
}

export interface PayoutRow {
  id: string;
  payoutNumber: string;
  channel: string;
  company: string;
  bankAccount: string;
  period: string;
  expectedAmount: number;
  receivedAmount: number;
  differenceAmount: number;
  retainedAmount: number;
  marginAmount: number;
  status: PayoutStatus;
  severity: Severity;
  components: MoneyBreakdown;
}

export interface DashboardSummary {
  totalSold: number;
  grossAmount: number;
  feeAmount: number;
  shippingAmount: number;
  adsAmount: number;
  expectedNetAmount: number;
  receivedAmount: number;
  differenceAmount: number;
  retainedAmount: number;
  criticalIssues: number;
  realMargin: number;
  marginPercent: number;
}

export type RuleOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: string | number | boolean;
}

export interface RuleConditionGroup {
  all?: RuleCondition[];
  any?: RuleCondition[];
}

export type RuleAction =
  | { type: "mark_audit"; when?: RuleCondition; reason: string; severity: Severity }
  | { type: "set_severity"; value: Severity }
  | { type: "add_tag"; value: string }
  | { type: "ignore_difference_below"; value: number };

export interface BusinessRuleDefinition {
  conditions: RuleConditionGroup;
  actions: RuleAction[];
}

export interface BusinessRule {
  id: string;
  name: string;
  module: string;
  priority: number;
  scope: Record<string, unknown>;
  status: "draft" | "active" | "paused" | "archived";
  version: number;
  definition: BusinessRuleDefinition;
}

export interface ChannelFeeRule {
  id: string;
  channel: string;
  ruleName: string;
  category?: string;
  subcategory?: string;
  sellerType?: string;
  listingType?: string;
  chargeBase: ChargeBase;
  percentageFee: number;
  percentageFeeMin?: number;
  percentageFeeMax?: number;
  fixedFee?: number;
  minimumFee?: number;
  maximumFee?: number;
  shippingFeePercent?: number;
  freePeriodDays?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceUrl?: string;
  sourceConfidence: FeeSourceConfidence;
  ruleOrigin: FeeRuleOrigin;
  isActive: boolean;
  notes?: string;
}

export interface FeeResolutionInput {
  channel: string;
  category?: string;
  subcategory?: string;
  sellerType?: string;
  listingType?: string;
  amount: number;
  shippingAmount: number;
  discountAmount: number;
  reportedMarketplaceFeeAmount?: number;
  reportedPercentageFee?: number;
  reportedFixedFeeAmount?: number;
  feeSourceType?: "spreadsheet" | "integration" | "manual";
  sourceFeePayload?: Record<string, unknown>;
  soldAt?: string;
}

export interface FeeResolutionResult {
  rule?: ChannelFeeRule;
  percentageFee: number;
  fixedFee: number;
  minimumFee?: number;
  maximumFee?: number;
  shippingFeePercent?: number;
  chargeBase: ChargeBase;
  commissionAmount: number;
  chargeBaseAmount: number;
  feeSource: FeeCalculationSource;
  needsFeeReview: boolean;
  reviewReasons: string[];
}

export interface RuleSimulationResult {
  ruleId: string;
  matchedCount: number;
  totalCount: number;
  estimatedImpact: number;
  auditCount: number;
  actions: Array<{ targetId: string; actionsApplied: RuleAction[] }>;
}

export interface FunctionDoc {
  id: string;
  module: string;
  title: string;
  objective: string;
  prerequisites: string[];
  steps: string[];
  commonErrors: string[];
  permissions: string[];
  acceptanceCriteria: string[];
}
