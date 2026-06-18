import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import {
  asCreativeLevelRule,
  evaluateSinglePerformanceRule,
  hasSufficientMetricData,
  type PerformanceRuleLike,
  type PerformanceViolation,
} from '@/lib/performanceRules';
import { getScopedCampaignIds } from '@/lib/creativeScope';
import { fetchAllPaginated } from '@/lib/supabasePaginate';

export interface CreativeWithMetrics {
  id: string;
  name: string;
  type: string;
  image_url: string | null;
  video_url: string | null;
  external_id: string | null;
  campaign_id: string;
  ad_set_id: string | null;
  ctr: number | null;
  cpc: number | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
}

export interface RuleBreakdownItem {
  creative: CreativeWithMetrics;
  violation: PerformanceViolation | null;
}

export interface RuleBreakdown {
  violating: RuleBreakdownItem[];
  compliant: RuleBreakdownItem[];
  insufficient_data: CreativeWithMetrics[];
  counts: { compliant: number; violating: number; insufficient: number };
}

export function usePerformanceRuleBreakdown() {
  const { user } = useAuth();
  const { effectiveIds } = useIntegrationFilter();
  const companyId = user?.company?.id;

  const query = useQuery({
    queryKey: ['performance-rule-breakdown', companyId, effectiveIds],
    queryFn: async (): Promise<CreativeWithMetrics[]> => {
      if (!companyId) return [];

      const validCampaignIds = await getScopedCampaignIds(companyId, effectiveIds);
      if (validCampaignIds.length === 0) return [];

      return fetchAllPaginated<CreativeWithMetrics>(() =>
        supabase
          .from('creatives')
          .select(
            'id, name, type, image_url, video_url, external_id, campaign_id, ad_set_id, ctr, cpc, spend, impressions, clicks, conversions',
          )
          .eq('company_id', companyId)
          .in('campaign_id', validCampaignIds)
          .ilike('status', 'active'),
      );
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const getBreakdownForRule = useCallback(
    (rule: PerformanceRuleLike): RuleBreakdown => {
      const creativeRule = asCreativeLevelRule(rule);
      const creatives = query.data ?? [];
      const violating: RuleBreakdownItem[] = [];
      const compliant: RuleBreakdownItem[] = [];
      const insufficient_data: CreativeWithMetrics[] = [];

      for (const creative of creatives) {
        if (!hasSufficientMetricData(creativeRule, creative)) {
          insufficient_data.push(creative);
          continue;
        }

        const violation = evaluateSinglePerformanceRule(creativeRule, creative);
        if (violation) {
          violating.push({ creative, violation });
        } else {
          compliant.push({ creative, violation: null });
        }
      }

      return {
        violating,
        compliant,
        insufficient_data,
        counts: {
          compliant: compliant.length,
          violating: violating.length,
          insufficient: insufficient_data.length,
        },
      };
    },
    [query.data],
  );

  return {
    ...query,
    creatives: query.data ?? [],
    getBreakdownForRule,
  };
}
