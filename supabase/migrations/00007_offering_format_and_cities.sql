-- =============================================================
-- Benefit Market — Offering Format (online/offline) + Cities
-- =============================================================
--
-- Adds a `format` (online | offline) column and a `cities` text[]
-- column to `provider_offerings`. Offline offerings may list one or
-- more cities where they are available.

-- 1. Enum for offering format
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offering_format') THEN
        CREATE TYPE offering_format AS ENUM ('online', 'offline');
    END IF;
END$$;

-- 2. Columns on provider_offerings
ALTER TABLE provider_offerings
    ADD COLUMN IF NOT EXISTS format offering_format NOT NULL DEFAULT 'online',
    ADD COLUMN IF NOT EXISTS cities text[]          NOT NULL DEFAULT '{}';

-- 3. Constraint: offline offerings must list at least one city
ALTER TABLE provider_offerings
    DROP CONSTRAINT IF EXISTS provider_offerings_offline_cities_required;

ALTER TABLE provider_offerings
    ADD CONSTRAINT provider_offerings_offline_cities_required
        CHECK (format = 'online' OR cardinality(cities) > 0);

-- 4. Index to support filtering offline offerings by city
CREATE INDEX IF NOT EXISTS idx_provider_offerings_cities
    ON provider_offerings USING GIN (cities);
