-- ===========================================================================
-- Migration 00012: employee_profiles.hire_date (source of truth for стаж)
-- ---------------------------------------------------------------------------
-- Adds employee_profiles.hire_date as a past-date column. Backfills from the
-- existing tenure_months so HR data is preserved, then installs a trigger
-- that recomputes tenure_months whenever hire_date is set/changed. The HR
-- UI displays стаж live from hire_date in full years; tenure_months is kept
-- as a denormalised cache used by eligibility rules and budget policies.
-- ===========================================================================

ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS hire_date date;

-- Backfill: every existing row gets a hire_date derived from tenure_months.
UPDATE employee_profiles
SET hire_date = (CURRENT_DATE - (tenure_months || ' months')::interval)::date
WHERE hire_date IS NULL;

-- hire_date must be in the past (or today).
ALTER TABLE employee_profiles
  DROP CONSTRAINT IF EXISTS employee_profiles_hire_date_past;
ALTER TABLE employee_profiles
  ADD CONSTRAINT employee_profiles_hire_date_past
  CHECK (hire_date IS NULL OR hire_date <= CURRENT_DATE);

-- ---------------------------------------------------------------------------
-- Trigger: keep tenure_months in sync with hire_date on insert / update.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_tenure_months_from_hire_date()
RETURNS trigger AS $$
BEGIN
  IF NEW.hire_date IS NOT NULL THEN
    NEW.tenure_months := GREATEST(
      0,
      (EXTRACT(YEAR  FROM age(CURRENT_DATE, NEW.hire_date)) * 12
       + EXTRACT(MONTH FROM age(CURRENT_DATE, NEW.hire_date)))::int
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_tenure_months ON employee_profiles;
CREATE TRIGGER trg_sync_tenure_months
  BEFORE INSERT OR UPDATE OF hire_date ON employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_tenure_months_from_hire_date();
