import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { integrationIdsKey, type MonitoredCampaignScope } from '@/hooks/useMonitoredCampaignScope';

export type MetricsPeriod = '1d' | '7d' | '15d' | '30d' | '90d' | { from: Date; to: Date };

interface MetricsData {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalInlineLinkClicks: number;
  totalConversions: number;
  avgCtr: number;
  avgLinkCtr: number;
  avgCpc: number;
  avgCpm: number;
  totalReach: number;
  reachIsApproximate: boolean;
  totalBudget: number;
  activeCampaigns: number;
  dailyData: Array<{
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    cpc: number;
    cpm: number;
  }>;
  topCampaigns: Array<{
    id: string;
    name: string;
    spend: number;
    conversions: number;
  }>;
  previousPeriod: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalInlineLinkClicks: number;
    totalConversions: number;
    totalReach: number;
    avgCtr: number;
    avgLinkCtr: number;
    avgCpc: number;
    avgCpm: number;
  };
}

export function useCompanyMetrics(
  period: MetricsPeriod,
  accountId?: string,
  integrationIds?: string[],
  campaignScope?: MonitoredCampaignScope | null,
  scopeLoading?: boolean,
) {
  const { user } = useAuth();
  const companyId = user?.company_id;

  return useQuery({
    queryKey: ['company-metrics', companyId, period, accountId, integrationIdsKey(integrationIds), campaignScope?.monitoredIntegrationIds.length ?? 'unset'],
    queryFn: async (): Promise<MetricsData> => {
      if (!companyId) throw new Error('No company ID');

      const emptyMetrics = (): MetricsData => ({
        totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalInlineLinkClicks: 0, totalConversions: 0,
        avgCtr: 0, avgLinkCtr: 0, avgCpc: 0, avgCpm: 0, totalReach: 0, reachIsApproximate: false,
        totalBudget: 0, activeCampaigns: 0,
        dailyData: [], topCampaigns: [], previousPeriod: {
          totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalInlineLinkClicks: 0, totalConversions: 0,
          totalReach: 0, avgCtr: 0, avgLinkCtr: 0, avgCpc: 0, avgCpm: 0,
        },
      });

      if (campaignScope && campaignScope.monitoredIntegrationIds.length === 0) {
        return emptyMetrics();
      }

      // --- 0. Prepare Valid Campaigns Filter (paginated to bypass Supabase 1000-row default) ---
      const campaigns = await fetchAllPaginated<any>(() => {
        let q = supabase
          .from('campaigns')
          .select('id, name, daily_budget, status, effective_status, integration_id')
          .eq('company_id', companyId)
          .not('integration_id', 'is', null);
        if (campaignScope && campaignScope.monitoredIntegrationIds.length > 0) {
          q = q.in('integration_id', campaignScope.monitoredIntegrationIds);
        } else if (accountId && accountId !== 'all') {
          q = q.eq('integration_id', accountId);
        } else if (integrationIds && integrationIds.length > 0) {
          q = q.in('integration_id', integrationIds);
        }
        return q;
      });

      // If no valid campaigns found (e.g. no active integrations, or selected account disconnected), return empty early
      if (!campaigns || campaigns.length === 0) {
        return emptyMetrics();
      }

      const validCampaignIds = new Set(campaigns.map(c => c.id));
      const hasSpecificAccount = accountId && accountId !== 'all';

      // Helper to optionally apply server-side filter to save bandwidth if filtering by specific account
      const applyCampaignFilter = (query: any, column = 'campaign_id') => {
        if (hasSpecificAccount) {
          return query.in(column, Array.from(validCampaignIds));
        }
        return query;
      };

      // --- 1. Fetch aggregated creative metrics (paginated) ---
      const rawCreatives = await fetchAllPaginated<any>(() =>
        applyCampaignFilter(
          supabase
            .from('creatives')
            .select('campaign_id, impressions, clicks, ctr, cpc, conversions, spend')
            .eq('company_id', companyId),
          'campaign_id'
        )
      );

      // Local filter: remove data from disconnected integrations (if all accounts selected)
      const creatives = rawCreatives.filter(c => validCampaignIds.has(c.campaign_id!));

      // --- 2. Fetch ad_sets for spend data (paginated) ---
      const rawAdSets = await fetchAllPaginated<any>(() =>
        applyCampaignFilter(
          supabase
            .from('ad_sets')
            .select('campaign_id, spend, daily_budget, impressions, clicks')
            .eq('company_id', companyId),
          'campaign_id'
        )
      );

      const adSets = rawAdSets.filter(a => validCampaignIds.has(a.campaign_id!));

      // Campaigns data is already fetched in Step 0. We'll use the 'campaigns' array.

      // --- 4. Fetch campaign_metrics for daily trend data ---
      let startDate = new Date();
      let endDate = new Date();
      let previousStartDate = new Date();
      let previousEndDate = new Date();

      if (typeof period === 'string') {
        const days = parseInt(period);
        if (period === '1d') {
          // Meta never has data for today — use yesterday
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
          previousStartDate.setDate(startDate.getDate() - 1);
          previousStartDate.setHours(0, 0, 0, 0);
          previousEndDate = new Date(previousStartDate);
          previousEndDate.setHours(23, 59, 59, 999);
        } else {
          // All other periods also end at yesterday (Meta has no same-day data)
          endDate.setDate(endDate.getDate() - 1);
          startDate.setDate(endDate.getDate() - days + 1);
          previousEndDate = new Date(startDate);
          previousEndDate.setDate(previousEndDate.getDate() - 1);
          previousStartDate = new Date(previousEndDate);
          previousStartDate.setDate(previousStartDate.getDate() - days + 1);
        }
      } else {
        startDate = period.from;
        endDate = period.to;
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(startDate.getDate() - (diffDays || 1));
        previousEndDate = new Date(startDate);
      }

      // Format dates as YYYY-MM-DD using LOCAL time (not UTC) to match campaign_metrics.date column
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const rawCurrentMetrics = await fetchAllPaginated<any>(() =>
        applyCampaignFilter(
          supabase
            .from('campaign_metrics')
            .select('campaign_id, date, spend, impressions, clicks, inline_link_clicks, cpc, cpm, conversions, reach')
            .eq('company_id', companyId)
            .gte('date', fmt(startDate))
            .lte('date', fmt(endDate))
            .order('date', { ascending: true }),
          'campaign_id'
        )
      );
      const currentMetrics = rawCurrentMetrics.filter(m => validCampaignIds.has(m.campaign_id!));

      const rawPreviousMetrics = await fetchAllPaginated<any>(() =>
        applyCampaignFilter(
          supabase
            .from('campaign_metrics')
            .select('campaign_id, date, spend, impressions, clicks, inline_link_clicks, cpc, cpm, conversions, reach')
            .eq('company_id', companyId)
            .gte('date', fmt(previousStartDate))
            .lt('date', fmt(previousEndDate)),
          'campaign_id'
        )
      );
      const previousMetrics = rawPreviousMetrics.filter(m => validCampaignIds.has(m.campaign_id!));

      // --- Aggregate periodic KPIs from currentMetrics (The Filtered View) ---
      const aggregatePeriod = (data: any[]) => {
        const spend = data.reduce((s, m) => s + Number(m.spend || 0), 0);
        const impressions = data.reduce((s, m) => s + Number(m.impressions || 0), 0);
        const clicks = data.reduce((s, m) => s + Number(m.clicks || 0), 0);
        const inlineLinkClicks = data.reduce((s, m) => s + Number(m.inline_link_clicks || 0), 0);
        const conversions = data.reduce((s, m) => s + Number(m.conversions || 0), 0);
        // Lower-bound reach fallback (used only when account_period_reach is unavailable,
        // e.g. custom date ranges). Σ max-daily-reach per campaign — diverges from Meta
        // because Meta dedupes unique users across campaigns and days.
        const reachByCampaign = new Map<string, number>();
        for (const m of data) {
          const cid = m.campaign_id as string;
          const r = Number(m.reach || 0);
          reachByCampaign.set(cid, Math.max(reachByCampaign.get(cid) || 0, r));
        }
        const reach = [...reachByCampaign.values()].reduce((a, b) => a + b, 0);
        return {
          totalSpend: spend,
          totalImpressions: impressions,
          totalClicks: clicks,
          totalInlineLinkClicks: inlineLinkClicks,
          totalConversions: conversions,
          totalReach: reach,
          avgCtr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          avgLinkCtr: impressions > 0 ? (inlineLinkClicks / impressions) * 100 : 0,
          avgCpc: clicks > 0 ? spend / clicks : 0,
          avgCpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        };
      };

      const current = aggregatePeriod(currentMetrics || []);
      const previous = aggregatePeriod(previousMetrics || []);

      // --- True account-level reach from account_period_reach (preset periods only) ---
      // For '1d' | '7d' | '15d' | '30d' | '90d' the sync pre-fetched the deduplicated
      // Meta-side reach value per integration. Sum it across selected integrations so
      // the dashboard matches Meta UI for those windows. Custom ranges fall back to the
      // aggregatePeriod() lower-bound estimate with reachIsApproximate=true.
      let totalReach = current.totalReach;
      let reachIsApproximate = true;
      if (typeof period === 'string') {
        const integrationFilter = hasSpecificAccount
          ? [accountId as string]
          : (integrationIds && integrationIds.length > 0
              ? integrationIds
              : [...new Set((campaigns || []).map(c => c.integration_id).filter(Boolean) as string[])]);

        if (integrationFilter.length > 0) {
          const { data: reachRows } = await supabase
            .from('account_period_reach')
            .select('integration_id, reach')
            .eq('company_id', companyId)
            .eq('period_key', period)
            .in('integration_id', integrationFilter);
          if (reachRows && reachRows.length > 0) {
            totalReach = reachRows.reduce((s, r: any) => s + Number(r.reach || 0), 0);
            reachIsApproximate = false;
          }
        }
      }

      // Use campaign_metrics data for the selected period (no creative-level fallback
      // since creatives hold lifetime totals and would show misleading data for short periods)
      const totalSpend = current.totalSpend;
      const totalImpressions = current.totalImpressions;
      const totalClicks = current.totalClicks;
      const totalInlineLinkClicks = current.totalInlineLinkClicks;
      const totalConversions = current.totalConversions;
      const avgCtr = current.avgCtr;
      const avgLinkCtr = current.avgLinkCtr;
      const avgCpc = current.avgCpc;
      const avgCpm = current.avgCpm;

      // --- Campaign budget and active count (Account state, not period-dependent) ---
      const totalBudget = (campaigns || []).reduce((sum, c) => sum + Number(c.daily_budget || 0), 0);
      const activeCampaigns = (campaigns || []).filter(
        c => c.status === 'ACTIVE' || c.effective_status === 'ACTIVE'
      ).length;

      // --- Daily data from campaign_metrics ---
      const dailyMap = (currentMetrics || []).reduce((acc: any, item: any) => {
        const date = item.date;
        if (!acc[date]) {
          acc[date] = { date, spend: 0, impressions: 0, clicks: 0, ctr: 0, conversions: 0, cpc: 0, cpm: 0 };
        }
        acc[date].spend += Number(item.spend || 0);
        acc[date].impressions += Number(item.impressions || 0);
        acc[date].clicks += Number(item.clicks || 0);
        acc[date].conversions += Number(item.conversions || 0);

        if (acc[date].impressions > 0) {
          acc[date].ctr = (acc[date].clicks / acc[date].impressions) * 100;
          acc[date].cpm = (acc[date].spend / acc[date].impressions) * 1000;
        }
        if (acc[date].clicks > 0) {
          acc[date].cpc = acc[date].spend / acc[date].clicks;
        }
        return acc;
      }, {});

      // --- Aggregated conversions per campaign for the period ---
      const campaignConvMap = (currentMetrics || []).reduce((acc: any, m: any) => {
        const cid = m.campaign_id;
        acc[cid] = (acc[cid] || 0) + Number(m.conversions || 0);
        return acc;
      }, {});

      // --- Top campaigns by daily_budget ---
      const topCampaigns = (campaigns || [])
        .map((camp: any) => ({
          id: camp.id,
          name: camp.name,
          spend: Number(camp.daily_budget || 0),
          conversions: campaignConvMap[camp.id] || 0,
        }))
        .sort((a: any, b: any) => b.spend - a.spend)
        .slice(0, 5);

      return {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalInlineLinkClicks,
        totalConversions,
        avgCtr,
        avgLinkCtr,
        avgCpc,
        avgCpm,
        totalReach,
        reachIsApproximate,
        totalBudget,
        activeCampaigns,
        dailyData: Object.values(dailyMap),
        topCampaigns,
        previousPeriod: previous,
      };
    },
    enabled: !!companyId && !scopeLoading,
    staleTime: 2 * 60 * 1000,
  });
}
