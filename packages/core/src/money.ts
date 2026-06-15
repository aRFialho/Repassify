import { calculateMarketplaceFee, demoChannelFeeRules } from "./fees.js";
import type { ChannelFeeRule, ExpectedReceivable, MoneyBreakdown, SaleInput } from "./types.js";

export const defaultBreakdown: MoneyBreakdown = {
  gross: 0,
  fee: 0,
  commission: 0,
  percentageCommission: 0,
  fixedFee: 0,
  minimumFeeAdjustment: 0,
  maximumFeeAdjustment: 0,
  shipping: 0,
  discount: 0,
  ads: 0,
  campaign: 0,
  anticipation: 0,
  refund: 0,
  subsidy: 0,
  tax: 0,
  informedTax: 0
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateExpectedReceivable(
  sale: SaleInput,
  feePercent: number,
  auditFlags: string[] = [],
  feeRules: ChannelFeeRule[] = demoChannelFeeRules
): ExpectedReceivable {
  const feeResolution = calculateMarketplaceFee(
    {
      channel: sale.channel,
      category: sale.category,
      subcategory: sale.subcategory,
      sellerType: sale.sellerType,
      listingType: sale.listingType,
      amount: sale.grossAmount,
      shippingAmount: sale.shippingAmount,
      discountAmount: sale.discountAmount,
      reportedMarketplaceFeeAmount: sale.reportedMarketplaceFeeAmount,
      reportedPercentageFee: sale.reportedPercentageFee,
      reportedFixedFeeAmount: sale.reportedFixedFeeAmount,
      feeSourceType: sale.feeSourceType,
      sourceFeePayload: sale.sourceFeePayload,
      soldAt: sale.soldAt ?? sale.expectedPayoutDate
    },
    feeRules,
    feePercent
  );

  const campaign = roundMoney(sale.campaignAmount ?? 0);
  const anticipation = roundMoney(sale.anticipationAmount ?? 0);
  const informedTax = roundMoney(sale.informedTaxAmount ?? 0);
  const fee = feeResolution.commissionAmount;
  const components: MoneyBreakdown = {
    gross: roundMoney(sale.grossAmount),
    fee,
    commission: fee,
    percentageCommission: roundMoney(feeResolution.chargeBaseAmount * (feeResolution.percentageFee / 100)),
    fixedFee: roundMoney(feeResolution.fixedFee),
    minimumFeeAdjustment: feeResolution.minimumFee ? roundMoney(Math.max(0, feeResolution.minimumFee - fee)) : 0,
    maximumFeeAdjustment: feeResolution.maximumFee ? roundMoney(Math.max(0, fee - feeResolution.maximumFee)) : 0,
    shipping: roundMoney(sale.shippingAmount),
    discount: roundMoney(sale.discountAmount),
    ads: roundMoney(sale.adsAmount),
    campaign,
    anticipation,
    refund: roundMoney(sale.refundAmount),
    subsidy: 0,
    tax: informedTax,
    informedTax
  };

  const expectedNetAmount = roundMoney(
    components.gross -
      components.fee -
      components.shipping -
      components.discount -
      components.ads -
      (components.campaign ?? 0) -
      (components.anticipation ?? 0) -
      components.refund +
      components.subsidy
  );

  const marginAmount = roundMoney(expectedNetAmount - sale.costAmount);
  const marginPercent = expectedNetAmount === 0 ? 0 : roundMoney((marginAmount / expectedNetAmount) * 100);

  return {
    saleId: sale.id,
    orderNumber: sale.orderNumber,
    channel: sale.channel,
    dueDate: sale.expectedPayoutDate,
    expectedNetAmount,
    marginAmount,
    marginPercent,
    components,
    auditFlags,
    needsFeeReview: feeResolution.needsFeeReview,
    feeReviewReasons: feeResolution.reviewReasons,
    feeRuleId: feeResolution.rule?.id,
    feeRuleName: feeResolution.rule?.ruleName,
    feeSourceConfidence: feeResolution.rule?.sourceConfidence,
    feeCalculationSource: feeResolution.feeSource,
    sourceFeePayload: sale.sourceFeePayload
  };
}

export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

export function formatCurrency(value: number, locale = "pt-BR", currency = "BRL"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}
