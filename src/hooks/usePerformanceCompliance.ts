import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import {
  evaluatePerformanceRules,
  isAdLevelPerformanceRule,
  type PerformanceRuleLike,
  type PerformanceViolation,
} from '@/lib/performanceRules';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { loadMonitoredScope } from '@/hooks/useMonitoredCampaignScope';

export interface PerformanceComplianceCounts {
  total_creatives: number;
  approved: number;
  rejected: number;
  not_checked: number;
}

export interface PerformanceComplianceMaps {
  byCampaign: Map<string, PerformanceComplianceCounts>;
  byAdSet: Map<string, PerformanceComplianceCounts>;
  /** 'approved' = no ad-level violations; 'rejected' = at least one; null = no ad-level rules configured */
  byCreative: Map<string, 'approved' | 'rejected' | null>;
  violationsByCreative: Map<string, PerformanceViolation[]>;
  /** Active rules scoped to ad/creative level */
  adLevelRules: PerformanceRuleLike[];
}

function emptyCounts(): PerformanceComplianceCounts {
  return { total_creatives: 0, approved: 0, rejected: 0, not_checked: 0 };
}

export function usePerformanceCompliance() {
  const { user } = useAuth();
  const { effectiveIds } = useIntegrationFilter();
  const companyId = user?.company?.id ?? user?.company_id;

  return useQuery({
    queryKey: ['performance-compliance', companyId, effectiveIds],
    queryFn: async (): Promise<PerformanceComplianceMaps> => {
      const empty: PerformanceComplianceMaps = {
        byCampaign: new Map(),
        byAdSet: new Map(),
        byCreative: new Map(),
        violationsByCreative: new Map(),
        adLevelRules: [],
      };
      if (!companyId) return empty;

      const { data: rulesRaw, error: rulesErr } = await supabase
        .from('automation_rules')
        .select('id, name, trigger_type, trigger_conditions, action_type, applies_to, status')
        .eq('company_id', companyId)
        .eq('status', 'active');
      if (rulesErr) throw rulesErr;

      const adLevelRules = ((rulesRaw || []) as PerformanceRuleLike[]).filter(isAdLevelPerformanceRule);
      const hasRules = adLevelRules.length > 0;

      const scope = await loadMonitoredScope(companyId, effectiveIds);
      if (scope.monitoredIntegrationIds.length === 0) return empty;

      const creatives = await fetchAllPaginated<{
        id: string;
        campaign_id: string;
        ad_set_id: string;
        ctr: number | null;
        cpc: number | null;
        spend: number | null;
        impressions: number | null;
        clicks: number | null;
        conversions: number | null;
      }>(() =>
        supabase
          .from('creatives')
          .select('id, campaign_id, ad_set_id, ctr, cpc, spend, impressions, clicks, conversions, campaigns!inner(integration_id)')
          .eq('company_id', companyId)
          .in('campaigns.integration_id', scope.monitoredIntegrationIds)
          .ilike('status', 'active'),
      );

      const byCampaign = new Map<string, PerformanceComplianceCounts>();
      const byAdSet = new Map<string, PerformanceComplianceCounts>();
      const byCreative = new Map<string, 'approved' | 'rejected' | null>();
      const violationsByCreative = new Map<string, PerformanceViolation[]>();

      for (const c of creatives ?? []) {
        let status: 'approved' | 'rejected' | null = null;
        let violations: PerformanceViolation[] = [];

        if (hasRules) {
          violations = evaluatePerformanceRules(adLevelRules, c);
          violationsByCreative.set(c.id, violations);
          status = violations.length > 0 ? 'rejected' : 'approved';
        }

        byCreative.set(c.id, status);

        const bumpCounts = (map: Map<string, PerformanceComplianceCounts>, key: string | null | undefined) => {
          if (!key) return;
          const counts = map.get(key) ?? emptyCounts();
          counts.total_creatives++;
          if (!hasRules) counts.not_checked++;
          else if (status === 'approved') counts.approved++;
          else if (status === 'rejected') counts.rejected++;
          map.set(key, counts);
        };

        bumpCounts(byCampaign, c.campaign_id);
        bumpCounts(byAdSet, c.ad_set_id);
      }

      return { byCampaign, byAdSet, byCreative, violationsByCreative, adLevelRules };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}
