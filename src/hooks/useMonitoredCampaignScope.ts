import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPaginated } from '@/lib/supabasePaginate';

export interface MonitoredCampaignScope {
  monitoredIntegrationIds: string[];
  validCampaignIds: string[];
}

/** Stable string for React Query keys derived from integration ID arrays. */
export function integrationIdsKey(integrationIds?: string[]): string {
  return integrationIds?.length ? [...integrationIds].sort().join(',') : 'all';
}

export const monitoredScopeQueryKey = (
  companyId: string,
  integrationIds?: string[],
) => ['monitored-campaign-scope', companyId, integrationIdsKey(integrationIds)] as const;

export async function loadMonitoredScope(
  companyId: string,
  integrationIds?: string[],
): Promise<MonitoredCampaignScope> {
  let monitoredIds = integrationIds ?? [];

  if (monitoredIds.length === 0) {
    const { data: allIntegrations, error } = await supabase
      .from('integrations')
      .select('id, is_monitored')
      .eq('company_id', companyId);

    if (error) throw error;

    monitoredIds = (allIntegrations ?? [])
      .filter((i: { is_monitored?: boolean }) => i.is_monitored === true)
      .map((i: { id: string }) => i.id);
  }

  if (monitoredIds.length === 0) {
    return { monitoredIntegrationIds: [], validCampaignIds: [] };
  }

  const activeCampaigns = await fetchAllPaginated<{ id: string }>(() =>
    supabase
      .from('campaigns')
      .select('id, integration_id')
      .eq('company_id', companyId)
      .in('integration_id', monitoredIds),
  );

  return {
    monitoredIntegrationIds: monitoredIds,
    validCampaignIds: activeCampaigns.map((c) => c.id),
  };
}

/**
 * Cached scope: monitored integration IDs + campaign IDs for the company.
 * Shared by useCreatives, useCreativesCount, useTopCreatives.
 */
export function useMonitoredCampaignScope(integrationIds?: string[]) {
  const { user } = useAuth();
  const companyId = user?.company_id;

  return useQuery({
    queryKey: monitoredScopeQueryKey(companyId ?? '', integrationIds),
    queryFn: () => loadMonitoredScope(companyId!, integrationIds),
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
