-- Entity-level audits (campaign / ad_set) alongside creative audits
ALTER TABLE public.audits
  ADD COLUMN IF NOT EXISTS audit_level text NOT NULL DEFAULT 'creative'
    CHECK (audit_level IN ('creative', 'ad_set', 'campaign'));

ALTER TABLE public.audits
  ADD COLUMN IF NOT EXISTS campaign_id uuid NULL REFERENCES public.campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.audits
  ADD COLUMN IF NOT EXISTS ad_set_id uuid NULL REFERENCES public.ad_sets(id) ON DELETE SET NULL;

-- creative_id was NOT NULL; allow entity-level rows
ALTER TABLE public.audits
  ALTER COLUMN creative_id DROP NOT NULL;

ALTER TABLE public.audits
  DROP CONSTRAINT IF EXISTS audits_entity_level_check;

ALTER TABLE public.audits
  ADD CONSTRAINT audits_entity_level_check CHECK (
    (audit_level = 'creative' AND creative_id IS NOT NULL AND campaign_id IS NULL AND ad_set_id IS NULL)
    OR (audit_level = 'campaign' AND campaign_id IS NOT NULL AND creative_id IS NULL AND ad_set_id IS NULL)
    OR (audit_level = 'ad_set' AND ad_set_id IS NOT NULL AND creative_id IS NULL AND campaign_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_audits_campaign_focus_created
  ON public.audits (campaign_id, audit_focus, created_at DESC)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audits_ad_set_focus_created
  ON public.audits (ad_set_id, audit_focus, created_at DESC)
  WHERE ad_set_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audits_level_focus_created
  ON public.audits (audit_level, audit_focus, created_at DESC);

-- RLS: scope by entity level
DROP POLICY IF EXISTS "audits_user_scope" ON public.audits;

CREATE POLICY "audits_user_scope" ON public.audits FOR ALL
USING (
    public.is_super_admin()
    OR (
        public.same_company(audits.company_id)
        AND (
            (audits.audit_level = 'creative' AND public.user_can_see_creative(audits.creative_id))
            OR (audits.audit_level = 'campaign' AND public.user_owns_campaign(audits.campaign_id))
            OR (audits.audit_level = 'ad_set' AND public.user_can_see_ad_set(audits.ad_set_id))
        )
    )
);
