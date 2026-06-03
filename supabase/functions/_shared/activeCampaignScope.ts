import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const ACTIVE_CAMPAIGN_STATUS_OR = 'status.eq.active,status.eq.ACTIVE';

export function isActiveCampaignStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return status.toLowerCase() === 'active';
}

export async function fetchActiveCampaignIds(
  supabase: SupabaseClient,
  companyId: string,
  integrationIds?: string[],
): Promise<string[]> {
  let monitoredIds = integrationIds?.length ? [...integrationIds] : [];

  if (monitoredIds.length === 0) {
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('id, is_monitored')
      .eq('company_id', companyId);
    if (error) throw new Error('Failed to fetch integrations for campaign scope');
    monitoredIds = (integrations ?? [])
      .filter((i: { is_monitored?: boolean }) => i.is_monitored === true)
      .map((i: { id: string }) => i.id);
    if (monitoredIds.length === 0) return [];
  }

  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id')
    .eq('company_id', companyId)
    .in('integration_id', monitoredIds)
    .or(ACTIVE_CAMPAIGN_STATUS_OR);

  if (campaignsError) throw new Error('Failed to fetch active campaigns');
  return (campaigns ?? []).map((c: { id: string }) => c.id);
}

export async function assertCreativeInActiveCampaign(
  supabase: SupabaseClient,
  companyId: string,
  creativeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: creative, error } = await supabase
    .from('creatives')
    .select('id, campaign_id, campaigns(status)')
    .eq('company_id', companyId)
    .eq('id', creativeId)
    .maybeSingle();

  if (error || !creative) {
    return { ok: false, error: 'Criativo não encontrado' };
  }

  const campaign = creative.campaigns as { status?: string } | null;
  if (!campaign) {
    return {
      ok: false,
      error: 'Criativo sem campanha ativa vinculada — análise disponível apenas para campanhas ativas',
    };
  }
  if (!isActiveCampaignStatus(campaign.status)) {
    return {
      ok: false,
      error: 'Campanha pausada — análise disponível apenas para campanhas ativas',
    };
  }

  return { ok: true };
}

export async function filterCreativesByActiveCampaign(
  supabase: SupabaseClient,
  companyId: string,
  creativeIds: string[],
): Promise<string[]> {
  if (!creativeIds.length) return [];

  const activeCampaignIds = await fetchActiveCampaignIds(supabase, companyId);
  if (activeCampaignIds.length === 0) return [];

  const { data, error } = await supabase
    .from('creatives')
    .select('id')
    .eq('company_id', companyId)
    .in('id', creativeIds)
    .in('campaign_id', activeCampaignIds);

  if (error) throw new Error('Failed to filter creatives by active campaign');
  return (data ?? []).map((c: { id: string }) => c.id);
}
