BEGIN;

SELECT set_config('app.tenant_id', '00000000-0000-4000-8000-000000000001', true);

INSERT INTO tenants (id, legal_name, trade_name, tax_id, plan_code, status)
VALUES ('00000000-0000-4000-8000-000000000001', 'Repassify Demo LTDA', 'Repassify Demo', '11222333000181', 'enterprise', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, full_name, status)
VALUES ('00000000-0000-4000-8000-000000000101', 'owner@repassify.local', 'Owner Demo', 'active')
ON CONFLICT (email) DO NOTHING;

INSERT INTO tenant_memberships (tenant_id, user_id, role, permissions)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000101',
  'owner',
  '{"manage_users": true, "close_period": true, "activate_rules": true}'::jsonb
)
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO companies (id, tenant_id, legal_name, trade_name, cnpj, tax_regime, finance_owner_name, finance_owner_email)
VALUES (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  'Loja Repassify Comercio Digital LTDA',
  'Loja Repassify',
  '11222333000181',
  'Simples Nacional',
  'Ana Financeiro',
  'financeiro@repassify.local'
)
ON CONFLICT (tenant_id, cnpj) DO NOTHING;

INSERT INTO channel_accounts (id, tenant_id, company_id, provider, external_account_id, display_name)
VALUES
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Shopee', 'shopee-demo', 'Shopee Loja Repassify'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Mercado Livre', 'ml-demo', 'Mercado Livre Repassify')
ON CONFLICT (tenant_id, provider, external_account_id) DO NOTHING;

INSERT INTO bank_accounts (id, tenant_id, company_id, bank_name, agency, account_number_masked)
VALUES ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Banco Neon', '0001', '****-2390')
ON CONFLICT DO NOTHING;

INSERT INTO rule_sets (id, tenant_id, company_id, name, description, module, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000201',
  'Regras de repasse por canal',
  'Regras financeiras deterministicas usadas no motor de conciliacao.',
  'payout',
  '00000000-0000-4000-8000-000000000101'
)
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO business_rules (id, tenant_id, rule_set_id, name, description, priority, scope, definition, status, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000502',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000501',
  'Shopee - auditoria de frete alto',
  'Marca auditoria quando frete passa de R$ 50; comissao e resolvida em channel_fee_rules.',
  100,
  '{"channel": "Shopee"}'::jsonb,
  '{
    "conditions": {"all": [{"field": "channel", "operator": "eq", "value": "Shopee"}]},
    "actions": [
      {"type": "mark_audit", "when": {"field": "shippingAmount", "operator": "gt", "value": 50}, "reason": "Frete acima de R$ 50 em pedido Shopee", "severity": "medium"}
    ]
  }'::jsonb,
  'active',
  '00000000-0000-4000-8000-000000000101'
)
ON CONFLICT DO NOTHING;

INSERT INTO business_rule_versions (tenant_id, rule_id, version, definition, definition_hash, change_reason, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000502',
  1,
  '{
    "conditions": {"all": [{"field": "channel", "operator": "eq", "value": "Shopee"}]},
    "actions": [
      {"type": "mark_audit", "when": {"field": "shippingAmount", "operator": "gt", "value": 50}, "reason": "Frete acima de R$ 50 em pedido Shopee", "severity": "medium"}
    ]
  }'::jsonb,
  encode(digest('shopee-v1', 'sha256'), 'hex'),
  'Fixture inicial obrigatoria',
  '00000000-0000-4000-8000-000000000101'
)
ON CONFLICT (rule_id, version) DO NOTHING;

INSERT INTO payouts (id, tenant_id, company_id, channel_account_id, bank_account_id, payout_number, period_start, period_end, expected_amount, received_amount, difference_amount, retained_amount, status, components)
VALUES
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000401', 'SHP-2026-06-A', '2026-06-01', '2026-06-07', 188420.70, 181260.10, -7160.60, 3340.00, 'divergent', '{"gross": 241200.00, "fees": 48240.00, "shipping": 9150.00, "ads": 2389.30}'::jsonb),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000401', 'ML-2026-06-A', '2026-06-01', '2026-06-07', 227340.80, 226990.20, -350.60, 0.00, 'audited', '{"gross": 270640.00, "fees": 28610.00, "shipping": 11920.00, "ads": 2769.20}'::jsonb)
ON CONFLICT (tenant_id, payout_number) DO NOTHING;

INSERT INTO reconciliation_issues (tenant_id, payout_id, issue_type, severity, amount_impact, status, explanation, evidence)
VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000601', 'shipping_fee_over_threshold', 'high', 2950.30, 'open', 'Frete Shopee excedeu a tolerancia e acionou auditoria.', '[{"rule": "Shopee 20%", "field": "shippingAmount", "operator": "gt", "value": 50}]'::jsonb),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000602', 'fee_rounding', 'low', 350.60, 'in_review', 'Diferenca dentro de margem baixa, aguardando conferencia.', '[{"tolerance": 500}]'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO function_docs (id, module, title, objective, prerequisites, steps, common_errors, permissions, acceptance_criteria)
VALUES
  ('finance.payout_center', 'Financeiro', 'Central de Repasses', 'Conciliar valores esperados, recebidos, divergentes e retidos por canal.', '["Empresa cadastrada", "Canal conectado ou arquivo importado"]'::jsonb, '["Selecionar periodo", "Filtrar canal e banco", "Abrir repasse", "Revisar calculo", "Resolver ou contestar divergencia", "Fechar periodo"]'::jsonb, '["Periodo sem dados", "Canal sem regra ativa", "Arquivo duplicado"]'::jsonb, '["view_values", "approve_payout", "close_period"]'::jsonb, '["Exibe esperado x recebido", "Toda acao sensivel gera audit_log", "Permite contestar e marcar auditoria"]'::jsonb),
  ('rules.engine', 'Configuracoes', 'Motor de Regras', 'Criar, simular, ativar e auditar regras deterministicas sem codigo.', '["Permissao para criar regras", "Dicionario de campos carregado"]'::jsonb, '["Escolher modulo", "Definir condicoes", "Definir acoes", "Simular", "Ativar"]'::jsonb, '["Conflito de prioridade", "Campo inexistente", "Regra sem versao"]'::jsonb, '["create_rule", "activate_rule"]'::jsonb, '["Simulacao mostra impacto financeiro", "Ativacao cria versao imutavel", "Execucao gera logs"]'::jsonb),
  ('companies.onboarding', 'Cadastros', 'Cadastro de Empresa', 'Cadastrar CNPJ, dados fiscais, canais, bancos e usuarios do tenant.', '["Usuario owner ou admin"]'::jsonb, '["Dados basicos", "Dados fiscais", "Canais", "Bancos", "Usuarios", "Revisao"]'::jsonb, '["CNPJ invalido", "Duplicidade no tenant", "Responsavel financeiro ausente"]'::jsonb, '["manage_companies"]'::jsonb, '["Valida CNPJ", "Impede duplicidade", "Alimenta modulos financeiros"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET updated_at = now();

COMMIT;
