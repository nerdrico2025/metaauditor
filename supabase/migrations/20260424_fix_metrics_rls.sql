-- Fix RLS policies for ad_set_metrics (and, as precaution, campaign_metrics).
-- The original ad_set_metrics migration (20250217) referenced a `profiles` table
-- that doesn't exist in this project — RLS checks against a missing relation fail
-- at policy-check time, so either the policies never applied or they silently
-- block all access depending on postgres version. Re-align them with the pattern
-- used by the fury_* tables: query public.users (id TEXT, = auth.uid()::text)
-- plus a service_role bypass so Edge Functions can upsert unhindered.

-- ─── ad_set_metrics ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view ad_set_metrics from their company" ON ad_set_metrics;
DROP POLICY IF EXISTS "Users can insert ad_set_metrics for their company" ON ad_set_metrics;
DROP POLICY IF EXISTS "Users can update ad_set_metrics from their company" ON ad_set_metrics;
DROP POLICY IF EXISTS "ad_set_metrics_company_isolation" ON ad_set_metrics;
DROP POLICY IF EXISTS "ad_set_metrics_service_role" ON ad_set_metrics;

ALTER TABLE ad_set_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_set_metrics_company_isolation" ON ad_set_metrics
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()::text
        )
    );

CREATE POLICY "ad_set_metrics_service_role" ON ad_set_metrics
    FOR ALL USING (auth.role() = 'service_role');

-- ─── campaign_metrics ─────────────────────────────────────────────────────
-- campaign_metrics has no tracked migration in this repo; align it defensively
-- with the same pattern so sync/Edge Functions work regardless of how the
-- table's policies were originally created.
DROP POLICY IF EXISTS "Users can view campaign_metrics from their company" ON campaign_metrics;
DROP POLICY IF EXISTS "Users can insert campaign_metrics for their company" ON campaign_metrics;
DROP POLICY IF EXISTS "Users can update campaign_metrics from their company" ON campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics_company_isolation" ON campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics_service_role" ON campaign_metrics;

ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_metrics_company_isolation" ON campaign_metrics
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()::text
        )
    );

CREATE POLICY "campaign_metrics_service_role" ON campaign_metrics
    FOR ALL USING (auth.role() = 'service_role');
