import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated, fetchAllPaginatedInChunks } from '@/lib/supabasePaginate';

export interface AggregatedListMetrics {
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  frequency: number;
}

const emptyMetrics = (): AggregatedListMetrics => ({
  spend: 0,
  conversions: 0,
  impressions: 0,
  clicks: 0,
  reach: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
  cpa: 0,
  frequency: 0,
});

function finalizeMetrics(t: {
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  reach: number;
}): AggregatedListMetrics {
  const ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
  const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
  const cpm = t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0;
  const cpa = t.conversions > 0 ? t.spend / t.conversions : 0;
  const frequency = t.reach > 0 ? t.impressions / t.reach : 0;
  return { ...t, ctr, cpc, cpm, cpa, frequency };
}

type MetricRow = {
  campaign_id?: string;
  ad_set_id?: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  reach: number | null;
};

function aggregateMetricRows(
  rows: MetricRow[],
  idKey: 'campaign_id' | 'ad_set_id',
): Map<string, AggregatedListMetrics> {
  const totals = new Map<
    string,
    { spend: number; conversions: number; impressions: number; clicks: number; reach: number }
  >();

  for (const row of rows) {
    const id = row[idKey];
    if (!id) continue;
    const cur = totals.get(id) ?? {
      spend: 0,
      conversions: 0,
      impressions: 0,
      clicks: 0,
      reach: 0,
    };
    cur.spend += Number(row.spend) || 0;
    cur.conversions += Number(row.conversions) || 0;
    cur.impressions += Number(row.impressions) || 0;
    cur.clicks += Number(row.clicks) || 0;
    cur.reach = Math.max(cur.reach, Number(row.reach) || 0);
    totals.set(id, cur);
  }

  const result = new Map<string, AggregatedListMetrics>();
  for (const [id, t] of totals) {
    result.set(id, finalizeMetrics(t));
  }
  return result;
}

export async function fetchCampaignPeriodMetrics(
  campaignIds: string[],
  startDate?: string,
  endDate?: string,
): Promise<Map<string, AggregatedListMetrics>> {
  if (campaignIds.length === 0) return new Map();

  const rows = await fetchAllPaginatedInChunks<MetricRow & { campaign_id: string }>(
    campaignIds,
    (chunkIds) => {
      let q = supabase
        .from('campaign_metrics')
        .select('campaign_id, spend, impressions, clicks, conversions, reach')
        .in('campaign_id', chunkIds);
      if (startDate) q = q.gte('date', startDate);
      if (endDate) q = q.lte('date', endDate);
      return q;
    },
  );

  return aggregateMetricRows(rows, 'campaign_id');
}

export async function fetchAdSetPeriodMetrics(
  adSetIds: string[],
  startDate?: string,
  endDate?: string,
): Promise<Map<string, AggregatedListMetrics>> {
  if (adSetIds.length === 0) return new Map();

  const rows = await fetchAllPaginatedInChunks<MetricRow & { ad_set_id: string }>(
    adSetIds,
    (chunkIds) => {
      let q = supabase
        .from('ad_set_metrics')
        .select('ad_set_id, spend, impressions, clicks, conversions, reach')
        .in('ad_set_id', chunkIds);
      if (startDate) q = q.gte('date', startDate);
      if (endDate) q = q.lte('date', endDate);
      return q;
    },
  );

  return aggregateMetricRows(rows, 'ad_set_id');
}

/** Lifetime totals from denormalized columns on campaigns. */
export function metricsFromCampaignRow(campaign: {
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  conversions?: number | null;
}): AggregatedListMetrics {
  const spend = Number(campaign.spend) || 0;
  const impressions = Number(campaign.impressions) || 0;
  const clicks = Number(campaign.clicks) || 0;
  const conversions = Number(campaign.conversions) || 0;
  return finalizeMetrics({
    spend,
    impressions,
    clicks,
    conversions,
    reach: 0,
  });
}

export function metricsFromAggregated(m: AggregatedListMetrics | undefined): {
  spend: number;
  conversions: number;
  cpa: number;
  ctr: number;
  impressions: number;
  clicks: number;
} {
  if (!m) {
    const e = emptyMetrics();
    return { spend: e.spend, conversions: e.conversions, cpa: e.cpa, ctr: e.ctr, impressions: e.impressions, clicks: e.clicks };
  }
  return {
    spend: m.spend,
    conversions: m.conversions,
    cpa: m.cpa,
    ctr: m.ctr,
    impressions: m.impressions,
    clicks: m.clicks,
  };
}
