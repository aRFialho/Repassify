import type { ChannelFeeRule, ChargeBase, FeeResolutionInput, FeeResolutionResult } from "./types.js";

const referenceDate = "2026-06-15";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const demoChannelFeeRules: ChannelFeeRule[] = [
  {
    id: "fee_ml_default_2026",
    channel: "Mercado Livre",
    ruleName: "Mercado Livre - faixa base 2026",
    chargeBase: "product",
    percentageFee: 19,
    percentageFeeMin: 10,
    percentageFeeMax: 19,
    fixedFee: 0,
    effectiveFrom: referenceDate,
    sourceConfidence: "market",
    ruleOrigin: "reference_seed",
    sourceUrl: "Mercado Livre custos oficiais + Koncili categoria 2026",
    isActive: true,
    notes: "Classico 10%-14%; Premium 15%-19%; custo fixo pode aplicar abaixo de R$ 79."
  },
  {
    id: "fee_shopee_default_2026",
    channel: "Shopee",
    ruleName: "Shopee - faixa base 2026",
    chargeBase: "discounted_product",
    percentageFee: 20,
    percentageFeeMin: 12,
    percentageFeeMax: 20,
    fixedFee: 0,
    effectiveFrom: "2026-03-01",
    sourceConfidence: "market",
    ruleOrigin: "reference_seed",
    sourceUrl: "Shopee Seller Center + UpSeller + E-Commerce Brasil",
    isActive: true,
    notes: "Modelo ajustado em 2026; validar por CPF/CNPJ e programa no Seller Center."
  },
  {
    id: "fee_amazon_default_2026",
    channel: "Amazon",
    ruleName: "Amazon Brasil - faixa por categoria",
    chargeBase: "product",
    percentageFee: 15,
    percentageFeeMin: 10,
    percentageFeeMax: 15,
    minimumFee: 1,
    effectiveFrom: referenceDate,
    sourceConfidence: "official",
    ruleOrigin: "reference_seed",
    sourceUrl: "Amazon Brasil tarifas oficiais",
    isActive: true,
    notes: "Plano Individual pode ter R$ 2 por item; profissional pode ter mensalidade."
  },
  {
    id: "fee_magalu_promo_2026",
    channel: "Magalu",
    ruleName: "Magalu - promocional novos cadastros",
    chargeBase: "product",
    percentageFee: 9.9,
    percentageFeeMin: 9.9,
    percentageFeeMax: 9.9,
    freePeriodDays: 90,
    effectiveFrom: referenceDate,
    sourceConfidence: "official",
    ruleOrigin: "reference_seed",
    sourceUrl: "Universo Magalu",
    isActive: true,
    notes: "Promocao por 3 meses ou ate R$ 100 mil; regra padrao deve vir de contrato/categoria."
  },
  {
    id: "fee_shein_default_2026",
    channel: "Shein",
    ruleName: "Shein Brasil - base publica",
    chargeBase: "discounted_product",
    percentageFee: 16,
    percentageFeeMin: 16,
    percentageFeeMax: 16,
    effectiveFrom: referenceDate,
    sourceConfidence: "market",
    ruleOrigin: "reference_seed",
    sourceUrl: "Politica oficial Shein + Nuvemshop",
    isActive: true,
    notes: "Pode haver isencao inicial e ajustes por data/categoria."
  },
  {
    id: "fee_americanas_default_2026",
    channel: "Americanas",
    ruleName: "Americanas Marketplace - faixa por departamento",
    chargeBase: "product",
    percentageFee: 19,
    percentageFeeMin: 12,
    percentageFeeMax: 19,
    effectiveFrom: referenceDate,
    sourceConfidence: "market",
    ruleOrigin: "reference_seed",
    sourceUrl: "Plugg.to + Magis5",
    isActive: true,
    notes: "Validar tabela vigente no Seller Center."
  },
  {
    id: "fee_casas_bahia_default_2026",
    channel: "Casas Bahia",
    ruleName: "Grupo Casas Bahia - faixa publica",
    chargeBase: "product",
    percentageFee: 21,
    percentageFeeMin: 18.5,
    percentageFeeMax: 21,
    effectiveFrom: referenceDate,
    sourceConfidence: "market",
    ruleOrigin: "reference_seed",
    sourceUrl: "Blog Casas Bahia Marketplace + Nuvemshop",
    isActive: true,
    notes: "Pode variar por contrato, categoria e campanhas promocionais."
  },
  {
    id: "fee_tiktok_shop_default_2026",
    channel: "TikTok Shop",
    ruleName: "TikTok Shop Brasil - taxa base",
    chargeBase: "product",
    percentageFee: 8,
    percentageFeeMin: 5,
    percentageFeeMax: 8,
    shippingFeePercent: 6,
    effectiveFrom: referenceDate,
    sourceConfidence: "market",
    ruleOrigin: "reference_seed",
    sourceUrl: "TikTok Seller Academy + Koncili",
    isActive: true,
    notes: "Pode haver taxa de envio e comissao de afiliado definida pelo seller."
  },
  {
    id: "fee_carrefour_default_2026",
    channel: "Carrefour",
    ruleName: "Carrefour Marketplace - referencia publica",
    chargeBase: "product_shipping",
    percentageFee: 16,
    percentageFeeMin: 16,
    percentageFeeMax: 16,
    effectiveFrom: referenceDate,
    sourceConfidence: "partner",
    ruleOrigin: "reference_seed",
    sourceUrl: "Bling/Carrefour Marketplace",
    isActive: true,
    notes: "Contrato pode variar por seller."
  },
  {
    id: "fee_madeira_default_2026",
    channel: "MadeiraMadeira",
    ruleName: "MadeiraMadeira - faixa oficial por categoria",
    chargeBase: "product_shipping",
    percentageFee: 19,
    percentageFeeMin: 14.5,
    percentageFeeMax: 19,
    effectiveFrom: referenceDate,
    sourceConfidence: "official",
    ruleOrigin: "reference_seed",
    sourceUrl: "Universidade MadeiraMadeira",
    isActive: true,
    notes: "Comissao calculada sobre valor total da compra conforme Portal do Lojista."
  },
  {
    id: "fee_netshoes_default_2026",
    channel: "Netshoes",
    ruleName: "Netshoes/Zattini - faixa de referencia",
    chargeBase: "product",
    percentageFee: 30,
    percentageFeeMin: 15,
    percentageFeeMax: 30,
    effectiveFrom: referenceDate,
    sourceConfidence: "market",
    ruleOrigin: "reference_seed",
    sourceUrl: "Universo Magalu/Netshoes + Nuvemshop/Koncili",
    isActive: true,
    notes: "Confirmar por contrato; categorias podem passar da faixa base."
  },
  {
    id: "fee_aliexpress_default_2026",
    channel: "AliExpress",
    ruleName: "AliExpress Brasil - faixa publica",
    chargeBase: "product",
    percentageFee: 10,
    percentageFeeMin: 5,
    percentageFeeMax: 10,
    effectiveFrom: referenceDate,
    sourceConfidence: "market",
    ruleOrigin: "reference_seed",
    sourceUrl: "E-commerce na Pratica + Magis5",
    isActive: true,
    notes: "Varia por categoria; sem mensalidade em fontes publicas."
  }
];

function normalize(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function isRuleEffective(rule: ChannelFeeRule, soldAt?: string): boolean {
  const date = soldAt ?? referenceDate;
  return rule.effectiveFrom <= date && (!rule.effectiveTo || rule.effectiveTo >= date);
}

function specificityScore(rule: ChannelFeeRule, input: FeeResolutionInput): number {
  let score = 0;
  const pairs: Array<[keyof ChannelFeeRule, keyof FeeResolutionInput, number]> = [
    ["category", "category", 16],
    ["subcategory", "subcategory", 8],
    ["sellerType", "sellerType", 4],
    ["listingType", "listingType", 2]
  ];

  for (const [ruleKey, inputKey, weight] of pairs) {
    const ruleValue = normalize(rule[ruleKey] as string | undefined);
    const inputValue = normalize(input[inputKey] as string | undefined);
    if (ruleValue && inputValue && ruleValue === inputValue) {
      score += weight;
    } else if (ruleValue && ruleValue !== inputValue) {
      return -1;
    }
  }

  return score;
}

export function resolveChannelFeeRule(input: FeeResolutionInput, rules: ChannelFeeRule[]): FeeResolutionResult {
  if (input.reportedMarketplaceFeeAmount != null) {
    const chargeBaseAmount = getChargeBaseAmount("product", input);
    const percentageFee =
      input.reportedPercentageFee ?? (chargeBaseAmount > 0 ? roundMoney((input.reportedMarketplaceFeeAmount / chargeBaseAmount) * 100) : 0);

    return {
      percentageFee,
      fixedFee: input.reportedFixedFeeAmount ?? 0,
      chargeBase: "product",
      commissionAmount: roundMoney(input.reportedMarketplaceFeeAmount),
      chargeBaseAmount,
      feeSource: "source_reported",
      needsFeeReview: false,
      reviewReasons: []
    };
  }

  const candidates = rules
    .filter((rule) => rule.isActive)
    .filter((rule) => normalize(rule.channel) === normalize(input.channel))
    .filter((rule) => isRuleEffective(rule, input.soldAt))
    .map((rule) => ({ rule, score: specificityScore(rule, input) }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score);

  const selected = candidates[0]?.rule;
  const ruleOrigin = selected?.ruleOrigin ?? "reference_seed";
  const feeSource = !selected ? "fallback_estimate" : ruleOrigin === "reference_seed" ? "reference_estimate" : "contract_rule";
  const needsFeeReview =
    !selected ||
    ruleOrigin === "reference_seed" ||
    !selected.category ||
    !input.category ||
    normalize(selected.category) !== normalize(input.category);
  const reviewReasons: string[] = [];

  if (!selected) {
    reviewReasons.push("missing_channel_fee_rule");
  } else {
    if (ruleOrigin === "reference_seed") {
      reviewReasons.push("reference_seed_used");
    }
    if (!selected.category || !input.category || normalize(selected.category) !== normalize(input.category)) {
      reviewReasons.push("default_channel_fee_rule_used");
    }
    if (selected.sourceConfidence !== "official" && selected.sourceConfidence !== "manual") {
      reviewReasons.push(`source_confidence_${selected.sourceConfidence}`);
    }
  }

  const fallbackPercentage = 0;
  const percentageFee = selected?.percentageFee ?? fallbackPercentage;
  const fixedFee = selected?.fixedFee ?? 0;
  const chargeBase = selected?.chargeBase ?? "product";
  const chargeBaseAmount = getChargeBaseAmount(chargeBase, input);
  const percentageCommission = roundMoney(chargeBaseAmount * (percentageFee / 100));
  let commissionAmount = roundMoney(percentageCommission + fixedFee);

  if (selected?.minimumFee && commissionAmount < selected.minimumFee) {
    commissionAmount = selected.minimumFee;
  }
  if (selected?.maximumFee && commissionAmount > selected.maximumFee) {
    commissionAmount = selected.maximumFee;
  }
  if (selected?.shippingFeePercent) {
    commissionAmount = roundMoney(commissionAmount + input.shippingAmount * (selected.shippingFeePercent / 100));
  }

  return {
    rule: selected,
    percentageFee,
    fixedFee,
    minimumFee: selected?.minimumFee,
    maximumFee: selected?.maximumFee,
    shippingFeePercent: selected?.shippingFeePercent,
    chargeBase,
    commissionAmount,
    chargeBaseAmount,
    feeSource,
    needsFeeReview,
    reviewReasons
  };
}

export function calculateMarketplaceFee(input: FeeResolutionInput, rules: ChannelFeeRule[], fallbackPercent = 0): FeeResolutionResult {
  const result = resolveChannelFeeRule(input, rules);
  if (result.rule || result.feeSource === "source_reported") {
    return result;
  }

  const chargeBaseAmount = getChargeBaseAmount("product", input);
  return {
    ...result,
    percentageFee: fallbackPercent,
    chargeBase: "product",
    chargeBaseAmount,
    commissionAmount: roundMoney(chargeBaseAmount * (fallbackPercent / 100)),
    feeSource: "fallback_estimate",
    needsFeeReview: true,
    reviewReasons: [...result.reviewReasons, "fallback_percentage_used"]
  };
}

export function getChargeBaseAmount(chargeBase: ChargeBase, input: FeeResolutionInput): number {
  if (chargeBase === "product_shipping") {
    return roundMoney(input.amount + input.shippingAmount);
  }

  if (chargeBase === "discounted_product") {
    return roundMoney(Math.max(0, input.amount - input.discountAmount));
  }

  return roundMoney(input.amount);
}
