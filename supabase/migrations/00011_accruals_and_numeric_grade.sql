-- ===========================================================================
-- Migration 00011: numeric grade + scheduled accruals (policies + individual)
-- ---------------------------------------------------------------------------
-- Depends on 00010 having committed the `semiannual` value to the
-- budget_period enum so that compute_next_accrual can reference it.
--
-- The text `grade` column is kept for backward compatibility with legacy
-- eligibility_rules / target_filter JSON that referenced it by string. All
-- new UI and rule builder code references `grade_numeric` instead.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. employee_profiles: numeric grade (10..18)
-- ---------------------------------------------------------------------------

ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS grade_numeric int
  CHECK (grade_numeric IS NULL OR (grade_numeric >= 10 AND grade_numeric <= 18));

-- Backfill from existing text grade if it looks like an integer, else from
-- well-known labels. Anything else is left NULL so HR can fill it in.
UPDATE employee_profiles
SET grade_numeric = sub.num
FROM (
  SELECT id, CASE
    WHEN grade ~ '^[0-9]+$' AND grade::int BETWEEN 10 AND 18 THEN grade::int
    WHEN lower(grade) IN ('junior', 'jun', 'джуниор', 'джун')               THEN 11
    WHEN lower(grade) IN ('middle', 'mid', 'мидл')                           THEN 13
    WHEN lower(grade) IN ('senior', 'sr', 'синьор', 'сеньор')                THEN 15
    WHEN lower(grade) IN ('lead', 'tl', 'тимлид', 'тимлидер', 'lead+', 'тл') THEN 17
    ELSE NULL
  END AS num
  FROM employee_profiles
) sub
WHERE employee_profiles.id = sub.id
  AND employee_profiles.grade_numeric IS NULL;

-- ---------------------------------------------------------------------------
-- 2. budget_policies: scheduling fields
-- ---------------------------------------------------------------------------

ALTER TABLE budget_policies
  ADD COLUMN IF NOT EXISTS first_accrual_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS next_accrual_date  date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS last_accrual_date  date,
  ADD COLUMN IF NOT EXISTS created_at         timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_budget_policies_next_accrual
  ON budget_policies (next_accrual_date)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 3. individual_accruals: per-employee overrides
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'individual_accrual_mode') THEN
    CREATE TYPE individual_accrual_mode AS ENUM ('addition', 'replacement');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS individual_accruals (
    id                  uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid                    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id             uuid                    NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    mode                individual_accrual_mode NOT NULL DEFAULT 'addition',
    points_amount       int                     NOT NULL CHECK (points_amount > 0),
    period              budget_period           NOT NULL DEFAULT 'monthly',
    first_accrual_date  date                    NOT NULL DEFAULT CURRENT_DATE,
    next_accrual_date   date                    NOT NULL DEFAULT CURRENT_DATE,
    last_accrual_date   date,
    description         text                    NOT NULL DEFAULT '',
    is_active           boolean                 NOT NULL DEFAULT true,
    created_by          uuid                             REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz             NOT NULL DEFAULT now(),
    updated_at          timestamptz             NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_individual_accruals_tenant_id
  ON individual_accruals (tenant_id);

CREATE INDEX IF NOT EXISTS idx_individual_accruals_user_id
  ON individual_accruals (user_id);

CREATE INDEX IF NOT EXISTS idx_individual_accruals_next_accrual
  ON individual_accruals (next_accrual_date)
  WHERE is_active = true;

ALTER TABLE individual_accruals ENABLE ROW LEVEL SECURITY;

-- HR sees / writes only inside their tenant; admin can read across all.
-- Helper functions for tenant_id / role are defined in 00002.
DROP POLICY IF EXISTS "tenant read individual_accruals"  ON individual_accruals;
DROP POLICY IF EXISTS "tenant write individual_accruals" ON individual_accruals;

CREATE POLICY "tenant read individual_accruals"
  ON individual_accruals
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    OR current_user_role() = 'admin'
  );

CREATE POLICY "tenant write individual_accruals"
  ON individual_accruals
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    OR current_user_role() = 'admin'
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR current_user_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- 4. compute_next_accrual: interval helper used by application code
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION compute_next_accrual(
  _from  date,
  _period budget_period
) RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _period
    WHEN 'monthly'    THEN (_from + interval '1 month' )::date
    WHEN 'quarterly'  THEN (_from + interval '3 months')::date
    WHEN 'semiannual' THEN (_from + interval '6 months')::date
    WHEN 'yearly'     THEN (_from + interval '1 year'  )::date
    ELSE (_from + interval '1 month')::date
  END;
$$;
