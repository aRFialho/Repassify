BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gin;

CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'finance_manager', 'analyst', 'auditor', 'accountant', 'viewer', 'support');
CREATE TYPE import_status AS ENUM ('uploaded', 'mapping', 'queued', 'processing', 'processed', 'failed', 'cancelled');
CREATE TYPE reconciliation_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE match_status AS ENUM ('matched', 'partial', 'unmatched', 'ignored', 'manual_confirmed');
CREATE TYPE issue_status AS ENUM ('open', 'in_review', 'contested', 'resolved', 'accepted_loss', 'ignored');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION current_app_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  trade_name text,
  tax_id text,
  plan_code text NOT NULL DEFAULT 'starter',
  status tenant_status NOT NULL DEFAULT 'trial',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  full_name text NOT NULL,
  avatar_url text,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'viewer',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role text NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role, permission)
);

CREATE TABLE user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role text NOT NULL,
  token_hash text NOT NULL,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  trade_name text,
  cnpj text NOT NULL,
  state_registration text,
  municipal_registration text,
  tax_regime text,
  cnae text,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  currency text NOT NULL DEFAULT 'BRL',
  finance_owner_name text,
  finance_owner_email text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cnpj)
);

CREATE TABLE channel_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  provider text NOT NULL,
  account_type text NOT NULL DEFAULT 'marketplace',
  external_account_id text,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  sync_cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_account_id)
);

CREATE TABLE integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_account_id uuid NOT NULL REFERENCES channel_accounts(id) ON DELETE CASCADE,
  credential_type text NOT NULL,
  encrypted_payload bytea NOT NULL,
  expires_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  bank_name text NOT NULL,
  agency text,
  account_number_masked text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_account_id uuid REFERENCES channel_accounts(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_name text,
  file_hash text,
  status import_status NOT NULL DEFAULT 'uploaded',
  row_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  mapping_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (tenant_id, file_hash)
);

CREATE TABLE import_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  storage_key text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sha256)
);

CREATE TABLE raw_records (
  id bigserial,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  record_type text NOT NULL,
  row_number integer NOT NULL,
  source_payload jsonb NOT NULL,
  normalized_hash text,
  error_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE raw_records_default PARTITION OF raw_records DEFAULT;
CREATE INDEX idx_raw_records_tenant_batch ON raw_records (tenant_id, batch_id);
CREATE INDEX idx_raw_records_payload_gin ON raw_records USING gin (source_payload);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_account_id uuid REFERENCES channel_accounts(id) ON DELETE SET NULL,
  external_order_id text NOT NULL,
  order_number text NOT NULL,
  status text NOT NULL,
  placed_at timestamptz NOT NULL,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  customer_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel_account_id, external_order_id)
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku text NOT NULL,
  title text,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  cost_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL,
  transaction_id text,
  installments integer NOT NULL DEFAULT 1,
  gross_amount numeric(14,2) NOT NULL,
  fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expected_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  channel_account_id uuid REFERENCES channel_accounts(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  expected_net_amount numeric(14,2) NOT NULL,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'expected',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_account_id uuid REFERENCES channel_accounts(id) ON DELETE SET NULL,
  payout_id text,
  settlement_date date NOT NULL,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  fees jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  channel_account_id uuid REFERENCES channel_accounts(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  payout_number text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  expected_amount numeric(14,2) NOT NULL DEFAULT 0,
  received_amount numeric(14,2) NOT NULL DEFAULT 0,
  difference_amount numeric(14,2) NOT NULL DEFAULT 0,
  retained_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'expected',
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, payout_number)
);

CREATE TABLE payout_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, name)
);

CREATE TABLE bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  posted_at timestamptz NOT NULL,
  amount numeric(14,2) NOT NULL,
  description text NOT NULL,
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE financial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status reconciliation_status NOT NULL DEFAULT 'queued',
  strategy text NOT NULL DEFAULT 'deterministic_v1',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE reconciliation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  expected_id uuid REFERENCES expected_receivables(id) ON DELETE SET NULL,
  settlement_id uuid REFERENCES settlements(id) ON DELETE SET NULL,
  bank_transaction_id uuid REFERENCES bank_transactions(id) ON DELETE SET NULL,
  score numeric(5,2) NOT NULL DEFAULT 0,
  status match_status NOT NULL DEFAULT 'unmatched',
  evidences jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reconciliation_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  payout_id uuid REFERENCES payouts(id) ON DELETE SET NULL,
  issue_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  amount_impact numeric(14,2) NOT NULL DEFAULT 0,
  status issue_status NOT NULL DEFAULT 'open',
  explanation text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payout_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payout_id uuid NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  issue_id uuid REFERENCES reconciliation_issues(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolution_note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  module text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE business_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_set_id uuid NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  priority integer NOT NULL DEFAULT 100,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  definition jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  current_version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE business_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES business_rules(id) ON DELETE CASCADE,
  version integer NOT NULL,
  definition jsonb NOT NULL,
  definition_hash text NOT NULL,
  change_reason text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, version)
);

CREATE TABLE rule_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES business_rules(id) ON DELETE CASCADE,
  rule_version integer NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  matched boolean NOT NULL,
  actions_applied jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE function_docs (
  id text PRIMARY KEY,
  module text NOT NULL,
  title text NOT NULL,
  objective text NOT NULL,
  prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  common_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  function_id text REFERENCES function_docs(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE help_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES agent_conversations(id) ON DELETE SET NULL,
  function_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('password', 'google')),
  provider_subject text,
  email citext NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  refresh_token_family uuid NOT NULL DEFAULT gen_random_uuid(),
  jwt_jti text NOT NULL,
  user_agent text,
  ip_address inet,
  mfa_verified boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_mfa_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('totp', 'recovery_code')),
  secret_encrypted text,
  recovery_code_hash text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  success boolean NOT NULL,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  ip_hash text,
  user_agent_hash text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_tenant_status ON orders (tenant_id, status, placed_at DESC);
CREATE INDEX idx_expected_tenant_due ON expected_receivables (tenant_id, due_date, status);
CREATE INDEX idx_payouts_tenant_period ON payouts (tenant_id, period_start, period_end, status);
CREATE INDEX idx_issues_tenant_status ON reconciliation_issues (tenant_id, status, severity);
CREATE INDEX idx_financial_events_tenant_date ON financial_events (tenant_id, event_date, event_type);
CREATE INDEX idx_audit_logs_tenant_entity ON audit_logs (tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX idx_rule_logs_target ON rule_execution_logs (tenant_id, target_type, target_id);

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_channel_accounts_updated_at BEFORE UPDATE ON channel_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payouts_updated_at BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_issues_updated_at BEFORE UPDATE ON reconciliation_issues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_business_rules_updated_at BEFORE UPDATE ON business_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_isolation ON tenants
  USING (id = current_app_tenant_id());

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tenant_memberships',
    'role_permissions',
    'user_invites',
    'companies',
    'channel_accounts',
    'integration_credentials',
    'bank_accounts',
    'import_batches',
    'import_files',
    'raw_records',
    'orders',
    'order_items',
    'payments',
    'expected_receivables',
    'settlements',
    'payouts',
    'payout_centers',
    'bank_transactions',
    'financial_events',
    'reconciliation_runs',
    'reconciliation_matches',
    'reconciliation_issues',
    'payout_audits',
    'rule_sets',
    'business_rules',
    'business_rule_versions',
    'rule_execution_logs',
    'agent_conversations',
    'agent_messages',
    'help_tickets',
    'auth_sessions',
    'auth_events',
    'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_app_tenant_id()) WITH CHECK (tenant_id = current_app_tenant_id())',
      table_name || '_tenant_isolation',
      table_name
    );
  END LOOP;
END $$;

COMMIT;
