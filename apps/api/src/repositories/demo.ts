import {
  demoDashboardSummary,
  demoChannelFeeRules,
  demoIssues,
  demoPayouts,
  demoSales,
  functionDocs,
  shopeeAuditRule
} from "@repassify/core";

export const demoTenant = {
  id: "00000000-0000-4000-8000-000000000001",
  legalName: "Repassify Demo LTDA",
  tradeName: "Repassify Demo",
  planCode: "enterprise",
  status: "active",
  timezone: "America/Sao_Paulo",
  limits: {
    rowsPerMonth: 1_000_000,
    connectors: 12,
    users: 50
  }
};

export const demoCompany = {
  id: "00000000-0000-4000-8000-000000000201",
  legalName: "Loja Repassify Comercio Digital LTDA",
  tradeName: "Loja Repassify",
  cnpj: "11222333000181",
  taxRegime: "Simples Nacional",
  timezone: "America/Sao_Paulo",
  currency: "BRL",
  financeOwnerName: "Ana Financeiro",
  financeOwnerEmail: "financeiro@repassify.local",
  status: "active"
};

export const demoUsers = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    email: "owner@repassify.local",
    fullName: "Owner Demo",
    role: "owner",
    status: "active",
    permissions: ["manage_users", "close_period", "activate_rules"]
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    email: "auditor@repassify.local",
    fullName: "Auditor Financeiro",
    role: "auditor",
    status: "invited",
    permissions: ["view_values", "approve_payout"]
  }
];

export const demoImports = [
  {
    id: "import_001",
    sourceType: "settlements",
    sourceName: "Shopee repasses junho.xlsx",
    fileHash: "sha256-demo-shopee",
    status: "mapping",
    rowCount: 2410,
    errorCount: 3
  }
];

export const demoState = {
  tenant: demoTenant,
  company: demoCompany,
  users: demoUsers,
  imports: demoImports,
  summary: demoDashboardSummary,
  payouts: demoPayouts,
  issues: demoIssues,
  sales: demoSales,
  rules: [shopeeAuditRule],
  feeRules: demoChannelFeeRules,
  functionDocs
};
