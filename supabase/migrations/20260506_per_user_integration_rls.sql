-- Per-user integration scoping (multi-login Phase B).
--
-- Before: every user in a company saw every integration and every downstream
-- record (campaigns, ad sets, creatives, metrics, audits) — driven by RLS that
-- only checked company_id.
--
-- After: each user sees only the integrations they created (where
-- integrations.user_id = auth.uid()) and the downstream data those integrations
-- own. Only super_admin keeps the wider company-wide view for support work.
--
-- Strategy: SECURITY DEFINER helpers encapsulate the "can I see this?" check
-- so policies stay short. Service role bypass is preserved everywhere so the
-- sync function and Edge Functions continue working unchanged.

-- ─── Helper functions ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS(
        SELECT 1 FROM users
        WHERE id = auth.uid()::text
          AND role = 'super_admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.same_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS(
        SELECT 1 FROM users
        WHERE id = auth.uid()::text
          AND company_id = p_company_id
    );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_integration(p_integration_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS(
        SELECT 1 FROM integrations
        WHERE id = p_integration_id
          AND user_id::text = auth.uid()::text
    );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_campaign(p_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS(
        SELECT 1 FROM campaigns c
        JOIN integrations i ON i.id = c.integration_id
        WHERE c.id = p_campaign_id
          AND i.user_id::text = auth.uid()::text
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_creative(p_creative_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS(
        SELECT 1
        FROM creatives cr
        JOIN campaigns c ON c.id = cr.campaign_id
        JOIN integrations i ON i.id = c.integration_id
        WHERE cr.id = p_creative_id
          AND i.user_id::text = auth.uid()::text
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_ad_set(p_ad_set_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS(
        SELECT 1
        FROM ad_sets a
        JOIN campaigns c ON c.id = a.campaign_id
        JOIN integrations i ON i.id = c.integration_id
        WHERE a.id = p_ad_set_id
          AND i.user_id::text = auth.uid()::text
    );
$$;

-- ─── integrations ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view integrations from their company" ON integrations;
DROP POLICY IF EXISTS "Users can insert integrations for their company" ON integrations;
DROP POLICY IF EXISTS "Users can update integrations from their company" ON integrations;
DROP POLICY IF EXISTS "Users can delete integrations from their company" ON integrations;
DROP POLICY IF EXISTS "integrations_company_isolation" ON integrations;
DROP POLICY IF EXISTS "integrations_user_scope" ON integrations;
DROP POLICY IF EXISTS "integrations_service_role" ON integrations;
DROP POLICY IF EXISTS "company_tenant_isolation" ON integrations;

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_user_scope" ON integrations FOR ALL
USING (
    public.is_super_admin()
    OR (
        public.same_company(integrations.company_id)
        AND integrations.user_id::text = auth.uid()::text
    )
)
WITH CHECK (
    public.is_super_admin()
    OR (
        public.same_company(integrations.company_id)
        AND integrations.user_id::text = auth.uid()::text
    )
);

CREATE POLICY "integrations_service_role" ON integrations FOR ALL
USING (auth.role() = 'service_role');

-- ─── campaigns ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view campaigns from their company" ON campaigns;
DROP POLICY IF EXISTS "Users can insert campaigns for their company" ON campaigns;
DROP POLICY IF EXISTS "Users can update campaigns from their company" ON campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns from their company" ON campaigns;
DROP POLICY IF EXISTS "campaigns_company_isolation" ON campaigns;
DROP POLICY IF EXISTS "campaigns_user_scope" ON campaigns;
DROP POLICY IF EXISTS "campaigns_service_role" ON campaigns;
DROP POLICY IF EXISTS "company_tenant_isolation" ON campaigns;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_user_scope" ON campaigns FOR ALL
USING (
    public.is_super_admin()
    OR (
        public.same_company(campaigns.company_id)
        AND public.user_owns_integration(campaigns.integration_id)
    )
);

CREATE POLICY "campaigns_service_role" ON campaigns FOR ALL
USING (auth.role() = 'service_role');

-- ─── ad_sets ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view ad_sets from their company" ON ad_sets;
DROP POLICY IF EXISTS "Users can insert ad_sets for their company" ON ad_sets;
DROP POLICY IF EXISTS "Users can update ad_sets from their company" ON ad_sets;
DROP POLICY IF EXISTS "Users can delete ad_sets from their company" ON ad_sets;
DROP POLICY IF EXISTS "ad_sets_company_isolation" ON ad_sets;
DROP POLICY IF EXISTS "ad_sets_user_scope" ON ad_sets;
DROP POLICY IF EXISTS "ad_sets_service_role" ON ad_sets;
DROP POLICY IF EXISTS "company_tenant_isolation" ON ad_sets;

ALTER TABLE ad_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_sets_user_scope" ON ad_sets FOR ALL
USING (
    public.is_super_admin()
    OR (
        public.same_company(ad_sets.company_id)
        AND public.user_owns_campaign(ad_sets.campaign_id)
    )
);

CREATE POLICY "ad_sets_service_role" ON ad_sets FOR ALL
USING (auth.role() = 'service_role');

-- ─── creatives ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view creatives from their company" ON creatives;
DROP POLICY IF EXISTS "Users can insert creatives for their company" ON creatives;
DROP POLICY IF EXISTS "Users can update creatives from their company" ON creatives;
DROP POLICY IF EXISTS "Users can delete creatives from their company" ON creatives;
DROP POLICY IF EXISTS "creatives_company_isolation" ON creatives;
DROP POLICY IF EXISTS "creatives_user_scope" ON creatives;
DROP POLICY IF EXISTS "creatives_service_role" ON creatives;
DROP POLICY IF EXISTS "company_tenant_isolation" ON creatives;

ALTER TABLE creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creatives_user_scope" ON creatives FOR ALL
USING (
    public.is_super_admin()
    OR (
        public.same_company(creatives.company_id)
        AND public.user_owns_campaign(creatives.campaign_id)
    )
);

CREATE POLICY "creatives_service_role" ON creatives FOR ALL
USING (auth.role() = 'service_role');

-- ─── campaign_metrics ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view campaign_metrics from their company" ON campaign_metrics;
DROP POLICY IF EXISTS "Users can insert campaign_metrics for their company" ON campaign_metrics;
DROP POLICY IF EXISTS "Users can update campaign_metrics from their company" ON campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics_company_isolation" ON campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics_user_scope" ON campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics_service_role" ON campaign_metrics;
DROP POLICY IF EXISTS "company_tenant_isolation" ON campaign_metrics;

ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_metrics_user_scope" ON campaign_metrics FOR ALL
USING (
    public.is_super_admin()
    OR (
        public.same_company(campaign_metrics.company_id)
        AND public.user_owns_campaign(campaign_metrics.campaign_id)
    )
);

CREATE POLICY "campaign_metrics_service_role" ON campaign_metrics FOR ALL
USING (auth.role() = 'service_role');

-- ─── ad_set_metrics ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view ad_set_metrics from their company" ON ad_set_metrics;
DROP POLICY IF EXISTS "Users can insert ad_set_metrics for their company" ON ad_set_metrics;
DROP POLICY IF EXISTS "Users can update ad_set_metrics from their company" ON ad_set_metrics;
DROP POLICY IF EXISTS "ad_set_metrics_company_isolation" ON ad_set_metrics;
DROP POLICY IF EXISTS "ad_set_metrics_user_scope" ON ad_set_metrics;
DROP POLICY IF EXISTS "ad_set_metrics_service_role" ON ad_set_metrics;
DROP POLICY IF EXISTS "company_tenant_isolation" ON ad_set_metrics;

ALTER TABLE ad_set_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_set_metrics_user_scope" ON ad_set_metrics FOR ALL
USING (
    public.is_super_admin()
    OR (
        public.same_company(ad_set_metrics.company_id)
        AND public.user_can_see_ad_set(ad_set_metrics.ad_set_id)
    )
);

CREATE POLICY "ad_set_metrics_service_role" ON ad_set_metrics FOR ALL
USING (auth.role() = 'service_role');

-- ─── creative_metrics ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view creative_metrics from their company" ON creative_metrics;
DROP POLICY IF EXISTS "Users can insert creative_metrics for their company" ON creative_metrics;
DROP POLICY IF EXISTS "Users can update creative_metrics from their company" ON creative_metrics;
DROP POLICY IF EXISTS "creative_metrics_company_isolation" ON creative_metrics;
DROP POLICY IF EXISTS "creative_metrics_user_scope" ON creative_metrics;
DROP POLICY IF EXISTS "creative_metrics_service_role" ON creative_metrics;
DROP POLICY IF EXISTS "company_tenant_isolation" ON creative_metrics;

ALTER TABLE creative_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creative_metrics_user_scope" ON creative_metrics FOR ALL
USING (
    public.is_super_admin()
    OR (
        public.same_company(creative_metrics.company_id)
        AND public.user_can_see_creative(creative_metrics.creative_id)
    )
);

CREATE POLICY "creative_metrics_service_role" ON creative_metrics FOR ALL
USING (auth.role() = 'service_role');

-- ─── audits ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view audits from their company" ON audits;
DROP POLICY IF EXISTS "Users can insert audits for their company" ON audits;
DROP POLICY IF EXISTS "Users can update audits from their company" ON audits;
DROP POLICY IF EXISTS "audits_company_isolation" ON audits;
DROP POLICY IF EXISTS "audits_user_scope" ON audits;
DROP POLICY IF EXISTS "audits_service_role" ON audits;
DROP POLICY IF EXISTS "company_tenant_isolation" ON audits;

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audits_user_scope" ON audits FOR ALL
USING (
    public.is_super_admin()
    OR (
        public.same_company(audits.company_id)
        AND public.user_can_see_creative(audits.creative_id)
    )
);

CREATE POLICY "audits_service_role" ON audits FOR ALL
USING (auth.role() = 'service_role');
