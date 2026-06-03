-- Adds per-company AI context. Lets each advertiser feed business-specific
-- knowledge (niche, audience, tone, targets) into every LLM call so the
-- platform's recommendations stop being generic.

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS ai_context jsonb;

COMMENT ON COLUMN companies.ai_context IS
'Business context fed into all LLM prompts. Shape:
{
  business_description: text,
  target_audience: text,
  tone_of_voice: text,
  key_offers: text,
  dos_and_donts: text,
  target_metrics: { ctr_min: number, cpc_max: number, cpa_target: number },
  extra_context: text
}';
