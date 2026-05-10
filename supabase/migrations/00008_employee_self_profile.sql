-- ===========================================================================
-- Migration 00008: employee self-profile fields
--
-- Adds typed columns for the personal information employees fill in their
-- "Мой профиль" cabinet:
--   • users.full_name           — ФИО (used across all roles, not only employees)
--   • employee_profiles.gender  — пол ('male' | 'female' | 'other' | NULL)
--   • employee_profiles.birthday — дата рождения
--
-- Mutable optional fields (marital status, children, work format, pets,
-- priorities) keep living in `employee_profiles.extra` as a JSONB blob —
-- they are too loose to deserve typed columns and never participate in
-- DB-level filtering.
--
-- Backfill: copies `name` from `employee_profiles.extra` and from
-- `auth.users.raw_user_meta_data` into the new column when available.
-- ===========================================================================

-- 1. Extensions --------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add columns -------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';

ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE employee_profiles
  DROP CONSTRAINT IF EXISTS employee_profiles_gender_check;

ALTER TABLE employee_profiles
  ADD CONSTRAINT employee_profiles_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));

ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS birthday date;

-- 3. Backfill users.full_name -----------------------------------------------

-- 3a. From employee_profiles.extra->>'name' (legacy CSV import target).
UPDATE users u
SET full_name = ep.extra->>'name'
FROM employee_profiles ep
WHERE ep.user_id = u.id
  AND u.full_name = ''
  AND ep.extra ? 'name'
  AND length(coalesce(ep.extra->>'name', '')) > 0;

-- 3b. From auth.users.raw_user_meta_data->>'name' (sign-up target).
-- Wrapped in DO block so it degrades gracefully on hosted Supabase
-- where the auth schema may be read-restricted.
DO $$
BEGIN
  UPDATE users u
  SET full_name = au.raw_user_meta_data->>'name'
  FROM auth.users au
  WHERE au.id = u.auth_id
    AND u.full_name = ''
    AND au.raw_user_meta_data ? 'name'
    AND length(coalesce(au.raw_user_meta_data->>'name', '')) > 0;
EXCEPTION
  WHEN insufficient_privilege OR undefined_table THEN
    -- auth schema not accessible from this role — leave empty.
    NULL;
END$$;

-- 4. Indexes ----------------------------------------------------------------

-- Speeds up HR employees search by name (ILIKE / fuzzy).
CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
  ON users USING gin (full_name gin_trgm_ops);
