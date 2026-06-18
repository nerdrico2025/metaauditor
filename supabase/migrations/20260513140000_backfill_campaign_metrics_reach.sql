-- Backfill campaign_metrics.reach (and derived fields) from ad_set_metrics.
-- Meta often omits reach at campaign + daily breakdown; ad set rows usually have it.
-- Uses MAX(reach) among ad sets under the same campaign on the same day (lower bound
-- vs true deduplicated campaign reach, but fixes NULL/zero with real movement).

UPDATE public.campaign_metrics cm
SET
  reach = sub.br,
  frequency = CASE
    WHEN sub.br > 0 THEN cm.impressions::numeric / sub.br::numeric
    ELSE cm.frequency
  END,
  ctr = CASE
    WHEN cm.impressions > 0 THEN (cm.clicks::numeric / cm.impressions::numeric) * 100
    ELSE cm.ctr
  END,
  cpc = CASE
    WHEN cm.clicks > 0 THEN cm.spend / NULLIF(cm.clicks::numeric, 0)
    ELSE cm.cpc
  END,
  cpm = CASE
    WHEN cm.impressions > 0 THEN (cm.spend / cm.impressions::numeric) * 1000
    ELSE cm.cpm
  END
FROM (
  SELECT
    c.company_id,
    c.id AS campaign_id,
    (asm.date)::date AS dt,
    MAX(COALESCE(asm.reach, 0))::bigint AS br
  FROM public.ad_set_metrics asm
  INNER JOIN public.ad_sets a
    ON a.id = asm.ad_set_id
   AND a.company_id = asm.company_id
  INNER JOIN public.campaigns c
    ON c.id = a.campaign_id
   AND c.company_id = a.company_id
  WHERE COALESCE(asm.reach, 0) > 0
  GROUP BY c.company_id, c.id, (asm.date)::date
) sub
WHERE cm.company_id = sub.company_id
  AND cm.campaign_id = sub.campaign_id
  AND cm.date = sub.dt
  AND cm.impressions > 0
  AND (cm.reach IS NULL OR cm.reach = 0)
  AND sub.br > 0;
