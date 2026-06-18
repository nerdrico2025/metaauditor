import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import {
    integrationIdsKey,
    loadMonitoredScope,
} from '@/hooks/useMonitoredCampaignScope';
import type { DateFilterRange } from '@/contexts/DateFilterContext';
import { hasDateRangeBounds, latestChecksPerCreativeInRange } from '@/lib/brandingDateScope';

/**
 * Branding compliance aggregations for the listing screens (Campanhas / Conjuntos).
 *
 * Source of truth: `creative_rule_checks` — only the LATEST check per creative is counted
 * (matches the dashboard's `useComplianceSummary` behaviour).
 *
 * Status semantics (briefing #3):
 *  - approved → contagem verde
 *  - warning + rejected → contagem vermelho ("reprovado")
 *  - creative sem check → not_checked
 */

export interface BrandingComplianceCounts {
    total_creatives: number;
    approved: number;
    rejected: number; // warning + rejected
    not_checked: number;
}

export interface BrandingComplianceMaps {
    /** company_id-wide map keyed by campaign_id */
    byCampaign: Map<string, BrandingComplianceCounts>;
    /** keyed by ad_set_id */
    byAdSet: Map<string, BrandingComplianceCounts>;
    /** latest known status per creative_id ('approved' | 'rejected' | null) */
    byCreative: Map<string, 'approved' | 'rejected' | null>;
}

function emptyCounts(): BrandingComplianceCounts {
    return { total_creatives: 0, approved: 0, rejected: 0, not_checked: 0 };
}

export function useBrandingCompliance(dateRange?: DateFilterRange) {
    const { user } = useAuth();
    const { effectiveIds } = useIntegrationFilter();
    const companyId = user?.company?.id ?? user?.company_id;
    const periodScoped = hasDateRangeBounds(dateRange);

    return useQuery({
        queryKey: [
            'branding-compliance',
            companyId,
            integrationIdsKey(effectiveIds),
            dateRange?.startDate,
            dateRange?.endDate,
            dateRange?.isAll,
        ],
        queryFn: async (): Promise<BrandingComplianceMaps> => {
            if (!companyId) return { byCampaign: new Map(), byAdSet: new Map(), byCreative: new Map() };

            const scope = await loadMonitoredScope(companyId, effectiveIds);
            if (scope.monitoredIntegrationIds.length === 0) {
                return { byCampaign: new Map(), byAdSet: new Map(), byCreative: new Map() };
            }

            const allCreatives = await fetchAllPaginated<{ id: string; campaign_id: string; ad_set_id: string }>(() =>
                supabase
                    .from('creatives')
                    .select('id, campaign_id, ad_set_id, campaigns!inner(integration_id)')
                    .eq('company_id', companyId)
                    .in('campaigns.integration_id', scope.monitoredIntegrationIds)
                    .ilike('status', 'active'),
            );

            const checks = await fetchAllPaginated<{
                creative_id: string;
                overall_status: string;
                checked_at: string;
            }>(() =>
                supabase
                    .from('creative_rule_checks')
                    .select('creative_id, overall_status, checked_at')
                    .eq('company_id', companyId)
                    .order('checked_at', { ascending: false }),
            );

            const latestStatusByCreative = new Map<string, 'approved' | 'rejected'>();
            const checksToProcess = hasDateRangeBounds(dateRange)
                ? [...latestChecksPerCreativeInRange(checks, dateRange.startDate, dateRange.endDate).values()]
                : checks;

            for (const row of checksToProcess) {
                if (latestStatusByCreative.has(row.creative_id)) continue;
                const s = row.overall_status;
                if (s === 'approved') latestStatusByCreative.set(row.creative_id, 'approved');
                else if (s === 'rejected' || s === 'warning') latestStatusByCreative.set(row.creative_id, 'rejected');
                else latestStatusByCreative.set(row.creative_id, null);
            }

            const byCampaign = new Map<string, BrandingComplianceCounts>();
            const byAdSet = new Map<string, BrandingComplianceCounts>();
            const byCreative = new Map<string, 'approved' | 'rejected' | null>();

            for (const c of allCreatives) {
                const status = latestStatusByCreative.get(c.id) ?? null;

                if (periodScoped && status === null) {
                    byCreative.set(c.id, null);
                    continue;
                }

                byCreative.set(c.id, status);

                const bumpCounts = (map: Map<string, BrandingComplianceCounts>, key: string | null | undefined) => {
                    if (!key) return;
                    const counts = map.get(key) ?? emptyCounts();
                    counts.total_creatives++;
                    if (status === 'approved') counts.approved++;
                    else if (status === 'rejected') counts.rejected++;
                    else counts.not_checked++;
                    map.set(key, counts);
                };

                bumpCounts(byCampaign, c.campaign_id);
                bumpCounts(byAdSet, c.ad_set_id);
            }

            return { byCampaign, byAdSet, byCreative };
        },
        enabled: !!companyId,
        staleTime: 60_000,
    });
}
