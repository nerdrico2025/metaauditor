import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveCrossFocusStatus, type CrossFocusDisplayStatus } from '@/lib/crossFocusAudit';
import { resolveBrandingCheckStatus } from '@/lib/brandingRuleCheckStatus';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { loadMonitoredScope } from '@/hooks/useMonitoredCampaignScope';

interface CreativeRuleCheckRow {
    creative_id: string;
    overall_status: string;
    results: Array<{ passed?: boolean; rule_name?: string; severity?: string; reason?: string }> | null;
}

export interface FetchActiveCreativeIdsScope {
    campaignId?: string;
    adSetId?: string;
    campaignIds?: string[];
    adSetIds?: string[];
}

const ACTIVE_CAMPAIGN_STATUS_OR = 'status.eq.active,status.eq.ACTIVE';

export async function fetchActiveCreativeIds(
    supabase: SupabaseClient,
    companyId: string,
    scope?: FetchActiveCreativeIdsScope,
): Promise<string[]> {
    const monitoredScope = await loadMonitoredScope(companyId);
    let campaignIds = monitoredScope.validCampaignIds;

    if (scope?.campaignIds?.length) {
        const allowed = new Set(scope.campaignIds);
        campaignIds = campaignIds.filter((id) => allowed.has(id));
    } else if (scope?.campaignId) {
        campaignIds = campaignIds.filter((id) => id === scope.campaignId);
    }

    if (campaignIds.length === 0) return [];

    const { data: activeCampaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('company_id', companyId)
        .in('id', campaignIds)
        .or(ACTIVE_CAMPAIGN_STATUS_OR);

    if (campaignError) throw campaignError;

    const activeCampaignIds = (activeCampaigns ?? []).map((c: { id: string }) => c.id);
    if (activeCampaignIds.length === 0) return [];

    const rows = await fetchAllPaginated<{ id: string }>(() => {
        let q = supabase
            .from('creatives')
            .select('id')
            .eq('company_id', companyId)
            .ilike('status', 'active')
            .in('campaign_id', activeCampaignIds);

        if (scope?.adSetId) q = q.eq('ad_set_id', scope.adSetId);
        if (scope?.adSetIds?.length) q = q.in('ad_set_id', scope.adSetIds);

        return q;
    });

    return rows.map((r) => r.id);
}

export async function fetchBrandingGateStatuses(
    supabase: SupabaseClient,
    companyId: string,
    creativeIds: string[],
): Promise<Map<string, CrossFocusDisplayStatus>> {
    const uniqueIds = [...new Set(creativeIds.filter(Boolean))];
    const statusMap = new Map<string, CrossFocusDisplayStatus>();
    if (!uniqueIds.length) return statusMap;

    const auditByCreative = new Map<string, string | null>();
    const { data: audits, error: auditError } = await supabase
        .from('audits')
        .select('creative_id, status, created_at')
        .eq('company_id', companyId)
        .eq('audit_focus', 'branding')
        .in('creative_id', uniqueIds)
        .order('created_at', { ascending: false });

    if (auditError) throw auditError;

    for (const row of audits ?? []) {
        if (!row.creative_id || auditByCreative.has(row.creative_id)) continue;
        auditByCreative.set(row.creative_id, row.status);
    }

    const ruleChecksMap = new Map<string, ReturnType<typeof resolveBrandingCheckStatus>>();
    const { data: checks, error: checkError } = await supabase
        .from('creative_rule_checks')
        .select('creative_id, overall_status, results')
        .eq('company_id', companyId)
        .in('creative_id', uniqueIds)
        .order('checked_at', { ascending: false });

    if (checkError) throw checkError;

    for (const row of (checks ?? []) as CreativeRuleCheckRow[]) {
        if (!row.creative_id || ruleChecksMap.has(row.creative_id)) continue;
        const results = row.results ?? [];
        const failedRules = results
            .filter((r) => !r.passed)
            .map((r) => ({
                rule_name: r.rule_name ?? '',
                severity: r.severity ?? '',
                reason: r.reason ?? '',
            }));
        ruleChecksMap.set(
            row.creative_id,
            resolveBrandingCheckStatus(row.overall_status, failedRules),
        );
    }

    for (const id of uniqueIds) {
        const ruleCheckStatus = ruleChecksMap.get(id);
        const status = resolveCrossFocusStatus({
            auditStatus: auditByCreative.get(id) ?? null,
            ruleCheckStatus,
        });
        statusMap.set(id, status);
    }

    return statusMap;
}

export async function fetchCreativeNamesByIds(
    supabase: SupabaseClient,
    companyId: string,
    creativeIds: string[],
): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(creativeIds.filter(Boolean))];
    const nameById = new Map<string, string>();
    if (!uniqueIds.length) return nameById;

    const { data, error } = await supabase
        .from('creatives')
        .select('id, name')
        .eq('company_id', companyId)
        .in('id', uniqueIds);

    if (error) throw error;

    for (const row of data ?? []) {
        if (row.id) nameById.set(row.id, row.name ?? `Criativo ${row.id.slice(0, 8)}`);
    }

    return nameById;
}
