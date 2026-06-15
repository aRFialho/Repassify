import { demoChannelFeeRules } from "./fees.js";
import { sumMoney } from "./money.js";
import { shopeeAuditRule } from "./rules.js";
import type {
  DashboardSummary,
  FunctionDoc,
  PayoutRow,
  ReconciliationIssue,
  SaleInput
} from "./types.js";

export const demoSales: SaleInput[] = [
  {
    id: "sale_1001",
    channel: "Shopee",
    orderNumber: "SHP-1001",
    grossAmount: 840,
    shippingAmount: 64.9,
    discountAmount: 20,
    adsAmount: 18.4,
    reportedMarketplaceFeeAmount: 151.2,
    reportedPercentageFee: 18,
    reportedFixedFeeAmount: 0,
    feeSourceType: "spreadsheet",
    sourceFeePayload: {
      column: "Comissao marketplace",
      file: "Shopee repasses junho.xlsx"
    },
    refundAmount: 0,
    costAmount: 410,
    expectedPayoutDate: "2026-06-21"
  },
  {
    id: "sale_1002",
    channel: "Mercado Livre",
    orderNumber: "ML-4104",
    grossAmount: 1290,
    shippingAmount: 44.2,
    discountAmount: 0,
    adsAmount: 29.7,
    refundAmount: 0,
    costAmount: 710,
    expectedPayoutDate: "2026-06-22"
  },
  {
    id: "sale_1003",
    channel: "Amazon",
    orderNumber: "AMZ-7790",
    grossAmount: 540,
    shippingAmount: 35,
    discountAmount: 12,
    adsAmount: 0,
    refundAmount: 0,
    costAmount: 280,
    expectedPayoutDate: "2026-06-24"
  }
];

export const demoPayouts: PayoutRow[] = [
  {
    id: "payout_shopee_01",
    payoutNumber: "SHP-2026-06-A",
    channel: "Shopee",
    company: "Loja Repassify",
    bankAccount: "Banco Neon ****-2390",
    period: "01/06 - 07/06",
    expectedAmount: 188420.7,
    receivedAmount: 181260.1,
    differenceAmount: -7160.6,
    retainedAmount: 3340,
    marginAmount: 41220.8,
    status: "divergent",
    severity: "high",
    components: {
      gross: 241200,
      fee: 48240,
      commission: 48240,
      shipping: 9150,
      discount: 3800,
      ads: 2389.3,
      refund: 3200,
      subsidy: 0,
      tax: 0
    }
  },
  {
    id: "payout_ml_01",
    payoutNumber: "ML-2026-06-A",
    channel: "Mercado Livre",
    company: "Loja Repassify",
    bankAccount: "Banco Neon ****-2390",
    period: "01/06 - 07/06",
    expectedAmount: 227340.8,
    receivedAmount: 226990.2,
    differenceAmount: -350.6,
    retainedAmount: 0,
    marginAmount: 62990.4,
    status: "audited",
    severity: "low",
    components: {
      gross: 270640,
      fee: 28610,
      commission: 28610,
      shipping: 11920,
      discount: 4120,
      ads: 2769.2,
      refund: 880,
      subsidy: 0,
      tax: 0
    }
  },
  {
    id: "payout_amazon_01",
    payoutNumber: "AMZ-2026-06-A",
    channel: "Amazon",
    company: "Loja Repassify",
    bankAccount: "Banco Neon ****-2390",
    period: "08/06 - 14/06",
    expectedAmount: 143870.2,
    receivedAmount: 143870.2,
    differenceAmount: 0,
    retainedAmount: 0,
    marginAmount: 38420.1,
    status: "received",
    severity: "low",
    components: {
      gross: 168900,
      fee: 15120,
      commission: 15120,
      shipping: 6210,
      discount: 2500,
      ads: 1199.8,
      refund: 0,
      subsidy: 0,
      tax: 0
    }
  }
];

export const demoIssues: ReconciliationIssue[] = [
  {
    id: "issue_shopee_shipping",
    issueType: "shipping_fee_over_threshold",
    severity: "high",
    amountImpact: 2950.3,
    status: "open",
    explanation: "Frete Shopee excedeu a regra de auditoria e precisa de evidencia antes do fechamento.",
    evidence: [
      { label: "rule", value: shopeeAuditRule.name },
      { label: "shippingAmount", value: 64.9 }
    ]
  },
  {
    id: "issue_missing_payout",
    issueType: "missing_payout",
    severity: "critical",
    amountImpact: 4210.3,
    status: "contested",
    explanation: "Pedidos pagos aparecem no ERP, mas nao constam no lote de repasse recebido.",
    evidence: [{ label: "orders", value: 7 }]
  },
  {
    id: "issue_fee_rounding",
    issueType: "fee_rounding",
    severity: "low",
    amountImpact: 350.6,
    status: "in_review",
    explanation: "Diferenca dentro de tolerancia baixa, pendente de conferencia operacional.",
    evidence: [{ label: "tolerance", value: 500 }]
  }
];

export const demoDashboardSummary: DashboardSummary = {
  totalSold: 680740,
  grossAmount: sumMoney(demoPayouts.map((payout) => payout.components.gross)),
  feeAmount: sumMoney(demoPayouts.map((payout) => payout.components.fee)),
  shippingAmount: sumMoney(demoPayouts.map((payout) => payout.components.shipping)),
  adsAmount: sumMoney(demoPayouts.map((payout) => payout.components.ads)),
  expectedNetAmount: sumMoney(demoPayouts.map((payout) => payout.expectedAmount)),
  receivedAmount: sumMoney(demoPayouts.map((payout) => payout.receivedAmount)),
  differenceAmount: sumMoney(demoPayouts.map((payout) => payout.differenceAmount)),
  retainedAmount: sumMoney(demoPayouts.map((payout) => payout.retainedAmount)),
  criticalIssues: demoIssues.filter((issue) => issue.severity === "critical" || issue.severity === "high").length,
  realMargin: sumMoney(demoPayouts.map((payout) => payout.marginAmount)),
  marginPercent: 21.1
};

export const functionDocs: FunctionDoc[] = [
  {
    id: "finance.payout_center",
    module: "Financeiro",
    title: "Central de Repasses",
    objective: "Conciliar esperado, recebido, divergente e retido por canal, periodo, banco e pedido.",
    prerequisites: ["Empresa cadastrada", "Canal conectado ou arquivo importado", "Regra financeira ativa"],
    steps: ["Selecionar periodo", "Filtrar canal e banco", "Abrir repasse", "Revisar calculo", "Resolver ou contestar", "Fechar periodo"],
    commonErrors: ["Periodo sem dados", "Canal sem regra ativa", "Arquivo duplicado"],
    permissions: ["view_values", "approve_payout", "close_period"],
    acceptanceCriteria: ["Exibe esperado x recebido", "Acoes sensiveis geram audit_log", "Permite auditoria e contestacao"]
  },
  {
    id: "rules.engine",
    module: "Configuracoes",
    title: "Motor de Regras",
    objective: "Criar, simular, ativar, versionar e auditar regras deterministicas sem codigo. Comissoes passam pela tabela versionada de taxas.",
    prerequisites: ["Permissao para criar regra", "Dicionario de campos carregado", "Tabela de comissoes ativa"],
    steps: ["Escolher modulo", "Definir condicoes", "Definir acoes", "Simular", "Ativar"],
    commonErrors: ["Conflito de prioridade", "Campo inexistente", "Regra sem versao", "Comissao sem regra exata por categoria"],
    permissions: ["create_rule", "activate_rule"],
    acceptanceCriteria: ["Simulacao mostra impacto", "Ativacao cria versao imutavel", "Execucao gera logs"]
  },
  {
    id: "fees.channel_rules",
    module: "Configuracoes",
    title: "Tabela de Comissoes e Taxas",
    objective: "Guardar referencias, contratos e tabelas importadas de comissao; taxas reportadas por planilha/API prevalecem no calculo.",
    prerequisites: ["Tenant ativo", "Canal cadastrado", "Permissao para editar regras financeiras"],
    steps: ["Escolher canal", "Definir escopo", "Informar base de cobranca", "Cadastrar taxas", "Validar fonte", "Ativar vigencia"],
    commonErrors: ["Regra padrao usada sem categoria", "Fonte de baixa confianca", "Vigencia sobreposta"],
    permissions: ["create_rule", "activate_rule", "view_values"],
    acceptanceCriteria: ["Sem taxa hardcoded", "Planilha/API prevalece", "Referencia base marca needs_fee_review", "Breakdown salva percentual, taxa fixa, frete, ads e campanha"]
  },
  {
    id: "companies.onboarding",
    module: "Cadastros",
    title: "Cadastro de Empresa",
    objective: "Cadastrar CNPJ, fiscal, canais, bancos e usuarios dentro do isolamento multi-tenant.",
    prerequisites: ["Usuario owner ou admin"],
    steps: ["Dados basicos", "Dados fiscais", "Canais", "Bancos", "Usuarios", "Revisao"],
    commonErrors: ["CNPJ invalido", "Duplicidade no tenant", "Responsavel financeiro ausente"],
    permissions: ["manage_companies"],
    acceptanceCriteria: ["Valida CNPJ", "Impede duplicidade", "Alimenta modulos financeiros"]
  }
];
