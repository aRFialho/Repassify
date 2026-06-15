BEGIN;

CREATE TABLE IF NOT EXISTS channel_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  channel_account_id uuid REFERENCES channel_accounts(id) ON DELETE SET NULL,
  channel_provider text NOT NULL,
  rule_name text NOT NULL,
  category text,
  subcategory text,
  seller_type text,
  listing_type text,
  charge_base text NOT NULL CHECK (charge_base IN ('product', 'product_shipping', 'discounted_product')),
  percentage_fee numeric(7,4) NOT NULL DEFAULT 0,
  percentage_fee_min numeric(7,4),
  percentage_fee_max numeric(7,4),
  fixed_fee numeric(14,2) NOT NULL DEFAULT 0,
  minimum_fee numeric(14,2),
  maximum_fee numeric(14,2),
  shipping_fee_percent numeric(7,4),
  free_period_days integer,
  effective_from date NOT NULL,
  effective_to date,
  source_url text,
  source_confidence text NOT NULL CHECK (source_confidence IN ('official', 'partner', 'market', 'manual')),
  rule_origin text NOT NULL DEFAULT 'reference_seed' CHECK (rule_origin IN ('reference_seed', 'seller_contract', 'imported_table', 'manual_override')),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_fee_rules_lookup
  ON channel_fee_rules (tenant_id, channel_provider, is_active, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_channel_fee_rules_scope
  ON channel_fee_rules (tenant_id, channel_provider, category, subcategory, seller_type, listing_type);

CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_fee_rules_scope_period
  ON channel_fee_rules (
    tenant_id,
    channel_provider,
    COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(channel_account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(category, ''),
    COALESCE(subcategory, ''),
    COALESCE(seller_type, ''),
    COALESCE(listing_type, ''),
    effective_from
  );

DROP TRIGGER IF EXISTS trg_channel_fee_rules_updated_at ON channel_fee_rules;
CREATE TRIGGER trg_channel_fee_rules_updated_at
  BEFORE UPDATE ON channel_fee_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE channel_fee_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'channel_fee_rules'
      AND policyname = 'channel_fee_rules_tenant_isolation'
  ) THEN
    CREATE POLICY channel_fee_rules_tenant_isolation ON channel_fee_rules
      USING (tenant_id = current_app_tenant_id())
      WITH CHECK (tenant_id = current_app_tenant_id());
  END IF;
END $$;

COMMIT;
