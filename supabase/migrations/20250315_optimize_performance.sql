-- ═══════════════════════════════════════════════════════════════════════════
-- OPTIMIZATION MIGRATION — Fix slow queries (15s+ profile fetches)
-- Run this in Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. CREATE exec_sql helper for future migrations
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void AS $$
BEGIN
    EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. FIX RLS POLICIES — wrap auth.uid() in (select auth.uid())
--    Without this, Postgres calls auth.uid() per-row instead of once.
--    This is the #1 cause of 10-60s query times in Supabase.
-- ─────────────────────────────────────────────────────────────────────────

-- Helper function to fix all policies automatically
DO $$
DECLARE
    pol RECORD;
    new_qual TEXT;
    new_check TEXT;
    recreate_sql TEXT;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (
              (qual IS NOT NULL AND qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%')
              OR
              (with_check IS NOT NULL AND with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%')
          )
    LOOP
        new_qual := REPLACE(COALESCE(pol.qual, 'true'), 'auth.uid()', '(select auth.uid())');
        new_check := REPLACE(COALESCE(pol.with_check, ''), 'auth.uid()', '(select auth.uid())');

        -- Drop existing policy
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);

        -- Recreate with optimized auth.uid()
        IF pol.cmd = 'SELECT' THEN
            EXECUTE format('CREATE POLICY %I ON %I.%I FOR SELECT USING (%s)', pol.policyname, pol.schemaname, pol.tablename, new_qual);
        ELSIF pol.cmd = 'INSERT' THEN
            IF new_check <> '' THEN
                EXECUTE format('CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (%s)', pol.policyname, pol.schemaname, pol.tablename, new_check);
            ELSE
                EXECUTE format('CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (%s)', pol.policyname, pol.schemaname, pol.tablename, new_qual);
            END IF;
        ELSIF pol.cmd = 'UPDATE' THEN
            IF new_check <> '' THEN
                EXECUTE format('CREATE POLICY %I ON %I.%I FOR UPDATE USING (%s) WITH CHECK (%s)', pol.policyname, pol.schemaname, pol.tablename, new_qual, new_check);
            ELSE
                EXECUTE format('CREATE POLICY %I ON %I.%I FOR UPDATE USING (%s)', pol.policyname, pol.schemaname, pol.tablename, new_qual);
            END IF;
        ELSIF pol.cmd = 'DELETE' THEN
            EXECUTE format('CREATE POLICY %I ON %I.%I FOR DELETE USING (%s)', pol.policyname, pol.schemaname, pol.tablename, new_qual);
        ELSE
            EXECUTE format('CREATE POLICY %I ON %I.%I USING (%s)', pol.policyname, pol.schemaname, pol.tablename, new_qual);
        END IF;

        RAISE NOTICE 'Fixed policy: %.% — %', pol.tablename, pol.policyname, pol.cmd;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. ADD MISSING INDEXES for frequently queried columns
-- ─────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_integrations_company_id ON integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_integrations_is_monitored ON integrations(is_monitored);
CREATE INDEX IF NOT EXISTS idx_campaigns_company_id ON campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_integration_id ON campaigns(integration_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_external_id ON campaigns(external_id);
CREATE INDEX IF NOT EXISTS idx_creatives_company_id ON creatives(company_id);
CREATE INDEX IF NOT EXISTS idx_creatives_external_id ON creatives(external_id);
CREATE INDEX IF NOT EXISTS idx_creatives_campaign_id ON creatives(campaign_id);
CREATE INDEX IF NOT EXISTS idx_creatives_status ON creatives(status);
CREATE INDEX IF NOT EXISTS idx_creatives_company_status ON creatives(company_id, status);
CREATE INDEX IF NOT EXISTS idx_creative_rules_company_id ON creative_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_creative_rule_checks_creative_id ON creative_rule_checks(creative_id);
CREATE INDEX IF NOT EXISTS idx_creative_rule_checks_company_id ON creative_rule_checks(company_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_company_campaign ON campaign_metrics(company_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date ON campaign_metrics(date);
CREATE INDEX IF NOT EXISTS idx_audits_creative_id ON audits(creative_id);
CREATE INDEX IF NOT EXISTS idx_audits_company_id ON audits(company_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. REFRESH STATISTICS & POSTGREST CACHE
-- ─────────────────────────────────────────────────────────────────────────

-- Force PostgREST to reload its schema cache (fixes stale cache hangs)
NOTIFY pgrst, 'reload schema';

-- Update table statistics so the query planner makes optimal decisions
ANALYZE users;
ANALYZE companies;
ANALYZE integrations;
ANALYZE campaigns;
ANALYZE ad_sets;
ANALYZE creatives;
ANALYZE campaign_metrics;
ANALYZE ad_set_metrics;
ANALYZE creative_rules;
ANALYZE creative_rule_checks;
ANALYZE audits;
