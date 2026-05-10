-- ===========================================================================
-- Migration 00010: extend budget_period enum with `semiannual`
-- ---------------------------------------------------------------------------
-- Postgres forbids referencing a newly added enum value inside the same
-- transaction that added it (SQLSTATE 55P04). This migration therefore only
-- adds the value; the function / table changes that use 'semiannual' live in
-- a subsequent migration so the ALTER TYPE has committed before they run.
-- ===========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'budget_period' AND e.enumlabel = 'semiannual'
  ) THEN
    ALTER TYPE budget_period ADD VALUE 'semiannual' AFTER 'quarterly';
  END IF;
END $$;
