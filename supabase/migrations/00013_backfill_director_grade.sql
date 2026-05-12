-- ===========================================================================
-- Migration 00013: backfill grade_numeric for "director" (and aliases) +
--                  trigger to auto-derive grade_numeric from text on insert
-- ---------------------------------------------------------------------------
-- Migration 00011 introduced grade_numeric (10..18) and a one-shot backfill
-- for junior/middle/senior/lead, but left "director" as NULL and did not
-- protect new inserts. That causes HR analytics to bucket director profiles
-- under "Без грейда" and lets any new row with only a text grade ship with
-- grade_numeric IS NULL.
--
-- This migration does two things:
--   1. Backfill remaining director profiles to grade_numeric = 18.
--   2. Install a BEFORE INSERT/UPDATE trigger that derives grade_numeric
--      from the text grade whenever it would otherwise be NULL, using the
--      same mapping table as 00011 plus the new "director → 18" rule.
-- ===========================================================================

-- 1. Backfill -----------------------------------------------------------------

UPDATE employee_profiles
SET grade_numeric = 18
WHERE grade_numeric IS NULL
  AND lower(grade) IN ('director', 'dir', 'директор');

-- 2. Trigger ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION derive_grade_numeric_from_text()
RETURNS trigger AS $$
BEGIN
  IF NEW.grade_numeric IS NULL AND NEW.grade IS NOT NULL THEN
    NEW.grade_numeric := CASE
      WHEN NEW.grade ~ '^[0-9]+$' AND NEW.grade::int BETWEEN 10 AND 18 THEN NEW.grade::int
      WHEN lower(NEW.grade) IN ('junior', 'jun', 'джуниор', 'джун')               THEN 11
      WHEN lower(NEW.grade) IN ('middle', 'mid', 'мидл')                           THEN 13
      WHEN lower(NEW.grade) IN ('senior', 'sr', 'синьор', 'сеньор')                THEN 15
      WHEN lower(NEW.grade) IN ('lead', 'tl', 'тимлид', 'тимлидер', 'lead+', 'тл') THEN 17
      WHEN lower(NEW.grade) IN ('director', 'dir', 'директор')                     THEN 18
      ELSE NULL
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_derive_grade_numeric ON employee_profiles;
CREATE TRIGGER trg_derive_grade_numeric
  BEFORE INSERT OR UPDATE OF grade, grade_numeric ON employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION derive_grade_numeric_from_text();
