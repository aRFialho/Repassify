BEGIN;

ALTER TABLE expected_receivables
  ADD COLUMN IF NOT EXISTS fee_source text NOT NULL DEFAULT 'fallback_estimate'
    CHECK (fee_source IN ('source_reported', 'contract_rule', 'reference_estimate', 'fallback_estimate')),
  ADD COLUMN IF NOT EXISTS needs_fee_review boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fee_review_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_fee_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_expected_fee_review
  ON expected_receivables (tenant_id, needs_fee_review, fee_source);

COMMIT;
