-- Dashboard accuracy: account-level reach buckets + inline link clicks.
--
-- Why:
--  - Reach is not additive (Meta dedupes unique users), so summing per-campaign
--    daily reach never matches Meta's account-level number for a date range.
--    Store one Meta-fetched reach value per (integration, preset period).
--  - Meta UI defaults its CTR to "link CTR" (inline_link_clicks / impressions),
--    not "all clicks CTR". We sync inline_link_clicks so the dashboard can
--    surface both side by side.
--
-- How sync uses these:
--  - account_period_reach: sync-meta-data hits /insights?level=account
--    with time_range matching each preset (1d/7d/15d/30d/90d) and upserts.
--  - inline_link_clicks columns: pulled from the existing
--    creative/campaign/adset insight calls (added to the `fields=` query).

-- ─── account_period_reach ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_period_reach (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    period_key TEXT NOT NULL CHECK (period_key IN ('1d', '7d', '15d', '30d', '90d')),
    reach BIGINT DEFAULT 0,
    frequency DECIMAL(10, 4) DEFAULT 0,
    impressions BIGINT DEFAULT 0,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT account_period_reach_unique UNIQUE (integration_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_account_period_reach_company ON account_period_reach(company_id);
CREATE INDEX IF NOT EXISTS idx_account_period_reach_integration ON account_period_reach(integration_id);

ALTER TABLE account_period_reach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_period_reach_company_isolation" ON account_period_reach
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()::text
        )
    );

CREATE POLICY "account_period_reach_service_role" ON account_period_reach
    FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE account_period_reach IS 'Per-integration account-level unique reach pre-fetched from Meta for fixed preset periods. Lets the dashboard show reach numbers that match Meta exactly (instead of summing per-campaign reach, which double-counts unique users).';

-- ─── inline_link_clicks columns ──────────────────────────────────────────
-- Add to all metrics tables and to creatives (lifetime).
-- Non-breaking: defaults to 0, code paths reading old rows still work.

ALTER TABLE creative_metrics
    ADD COLUMN IF NOT EXISTS inline_link_clicks BIGINT DEFAULT 0;

ALTER TABLE campaign_metrics
    ADD COLUMN IF NOT EXISTS inline_link_clicks BIGINT DEFAULT 0;

ALTER TABLE ad_set_metrics
    ADD COLUMN IF NOT EXISTS inline_link_clicks BIGINT DEFAULT 0;

ALTER TABLE creatives
    ADD COLUMN IF NOT EXISTS inline_link_clicks BIGINT DEFAULT 0;

COMMENT ON COLUMN creative_metrics.inline_link_clicks IS 'Meta inline_link_clicks: clicks on the ad link destination only (not all clicks). Used to derive "link CTR" matching Meta UI default.';
COMMENT ON COLUMN campaign_metrics.inline_link_clicks IS 'Meta inline_link_clicks at campaign level.';
COMMENT ON COLUMN ad_set_metrics.inline_link_clicks IS 'Meta inline_link_clicks at ad set level.';
COMMENT ON COLUMN creatives.inline_link_clicks IS 'Lifetime inline_link_clicks mirrored from ad-level insight totals.';
