import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/supabasePaginate';

/** PostgREST filter for active campaign status (Meta sync uses lowercase; legacy rows may be uppercase). */
export const ACTIVE_CAMPAIGN_STATUS_OR = 'status.eq.active,status.eq.ACTIVE';

export function isActiveCampaignStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return status.toLowerCase() === 'active';
}

/**
 * Campaign IDs from monitored integrations with status = active.
 * Used by analysis, compliance, and batch workflows (not general creative listing).
 */
export async function getScopedCampaignIds(
  companyId: string,
  integrationIds?: string[],
): Promise<string[]> {
  return getActiveCampaignIds(companyId, integrationIds);
}

/** Explicit alias for analysis-scoped campaign IDs. */
export async function getActiveCampaignIds(
  companyId: string,
  integrationIds?: string[],
): Promise<string[]> {
  let monitoredIds = integrationIds?.length ? [...integrationIds] : [];

  if (monitoredIds.length === 0) {
    const { data: allIntegrations, error } = await supabase
      .from('integrations')
      .select('id, is_monitored')
      .eq('company_id', companyId);
    if (error) throw error;
    monitoredIds = (allIntegrations ?? [])
      .filter((i) => i.is_monitored === true)
      .map((i) => i.id);
    if (monitoredIds.length === 0) return [];
  }

  const activeCampaigns = await fetchAllPaginated<{ id: string }>(() =>
    supabase
      .from('campaigns')
      .select('id, integration_id')
      .eq('company_id', companyId)
      .in('integration_id', monitoredIds)
      .or(ACTIVE_CAMPAIGN_STATUS_OR),
  );

  return activeCampaigns.map((c) => c.id);
}
