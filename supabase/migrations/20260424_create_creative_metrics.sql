-- Create creative_metrics table for storing daily creative (ad-level) performance metrics.
-- Mirrors ad_set_metrics / campaign_metrics so that date-range filtering on creatives
-- can aggregate from a true per-day breakdown instead of the lifetime totals kept on the
-- creatives table itself.

CREATE TABLE IF NOT EXISTS creative_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    creative_id UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Core metrics (raw from Meta API)
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    spend DECIMAL(12, 2) DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    reach BIGINT DEFAULT 0,
    frequency DECIMAL(10, 2) DEFAULT 0,

    -- Calculated / derived metrics
    cpc DECIMAL(10, 4) DEFAULT 0,
    cpm DECIMAL(10, 4) DEFAULT 0,
    ctr DECIMAL(10, 4) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT creative_metrics_unique UNIQUE (company_id, creative_id, date)
);

CREATE INDEX IF NOT EXISTS idx_creative_metrics_company_id ON creative_metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_creative_metrics_creative_id ON creative_metrics(creative_id);
CREATE INDEX IF NOT EXISTS idx_creative_metrics_date ON creative_metrics(date);
CREATE INDEX IF NOT EXISTS idx_creative_metrics_company_creative ON creative_metrics(company_id, creative_id);

ALTER TABLE creative_metrics ENABLE ROW LEVEL SECURITY;

-- Company isolation: users only see/write rows for their own company.
-- Uses the public.users table (id is TEXT, matching auth.uid()::text), consistent
-- with the pattern used by the fury_* tables.
CREATE POLICY "creative_metrics_company_isolation" ON creative_metrics
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()::text
        )
    );

-- Service role bypass: Edge Functions (sync-meta-data, crons) run with the
-- service_role key and need unrestricted access to upsert/update metrics.
CREATE POLICY "creative_metrics_service_role" ON creative_metrics
    FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE creative_metrics IS 'Stores daily performance metrics for individual creatives (Meta ads at level=ad). Populated by sync-meta-data Edge Function using time_increment=1.';
