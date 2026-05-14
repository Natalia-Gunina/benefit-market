-- ===========================================================================
-- Migration 00014: employee_recommendations cache
--
-- Stores LLM-generated (or popularity-based fallback) benefit recommendations
-- per employee. One row per user. Invalidated via hash mismatch
-- (profile_hash, catalog_hash) on read, and via eager DELETE on profile PATCH.
--
--   items        — jsonb array [{ tenant_offering_id: uuid, reason: text }],
--                  ordered by relevance.
--   source       — "llm" (personalized) or "popular" (fallback when profile
--                  is mostly empty or LLM call failed).
--   profile_hash — md5 of the profile subset that affects recommendations.
--   catalog_hash — md5 over the set of active tenant_offerings.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS employee_recommendations (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    items           jsonb       NOT NULL DEFAULT '[]'::jsonb,
    source          text        NOT NULL CHECK (source IN ('llm', 'popular')),
    profile_hash    text        NOT NULL,
    catalog_hash    text        NOT NULL,
    generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_recommendations_tenant
  ON employee_recommendations(tenant_id);

ALTER TABLE employee_recommendations ENABLE ROW LEVEL SECURITY;

-- Employee sees own row; admin/hr see all rows in tenant.
CREATE POLICY "employee_recommendations_select" ON employee_recommendations
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND (
      current_user_role() IN ('admin', 'hr')
      OR user_id = current_app_user_id()
    )
  );

-- All writes go through service_role from the API (cache regeneration).
-- RLS denies direct user writes.
CREATE POLICY "employee_recommendations_insert" ON employee_recommendations
  FOR INSERT WITH CHECK (false);

CREATE POLICY "employee_recommendations_update" ON employee_recommendations
  FOR UPDATE USING (false) WITH CHECK (false);

CREATE POLICY "employee_recommendations_delete" ON employee_recommendations
  FOR DELETE USING (false);
