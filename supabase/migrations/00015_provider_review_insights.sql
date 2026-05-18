-- ===========================================================================
-- Migration 00015: provider_review_insights cache
--
-- Stores LLM-generated AI analysis of employee reviews per provider offering.
-- One row per offering. Invalidated via source_hash mismatch on read — the
-- hash covers the set of visible reviews (ids + updated_at), so any new or
-- edited review automatically forces a regeneration on the next request.
--
--   source_hash   — md5 of (PROMPT_VERSION, sorted ids+updated_at of visible
--                   reviews). Cache hit iff this matches the freshly computed
--                   hash from the live reviews table.
--   strengths     — jsonb array [{ text: string, percent: int 1..100 }],
--                   sorted by percent desc. What employees praise.
--   weaknesses    — same shape, what employees complain about.
--   summary       — short natural-language wrap-up (1-2 sentences).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS provider_review_insights (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_offering_id        uuid        NOT NULL UNIQUE
        REFERENCES provider_offerings(id) ON DELETE CASCADE,
    source_hash                 text        NOT NULL,
    reviews_count_at_generation int         NOT NULL,
    strengths                   jsonb       NOT NULL DEFAULT '[]'::jsonb,
    weaknesses                  jsonb       NOT NULL DEFAULT '[]'::jsonb,
    summary                     text        NOT NULL DEFAULT '',
    model                       text        NOT NULL,
    generated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_review_insights_offering
    ON provider_review_insights(provider_offering_id);

ALTER TABLE provider_review_insights ENABLE ROW LEVEL SECURITY;

-- Reads: admin sees all; provider sees insights only for own offerings.
-- API endpoint uses service_role, but this policy is the safety net.
CREATE POLICY "provider_review_insights_select" ON provider_review_insights
    FOR SELECT USING (
        current_user_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM provider_offerings po
            JOIN providers p ON p.id = po.provider_id
            WHERE po.id = provider_review_insights.provider_offering_id
              AND p.owner_user_id = current_app_user_id()
        )
    );

-- All writes go through service_role from the API (cache regeneration).
CREATE POLICY "provider_review_insights_insert" ON provider_review_insights
    FOR INSERT WITH CHECK (false);

CREATE POLICY "provider_review_insights_update" ON provider_review_insights
    FOR UPDATE USING (false) WITH CHECK (false);

CREATE POLICY "provider_review_insights_delete" ON provider_review_insights
    FOR DELETE USING (false);
