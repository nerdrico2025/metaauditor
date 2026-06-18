import type { SupabaseClient } from '@supabase/supabase-js';
import { BATCH_SKIP_RECENT_HOURS } from '@/config/auditConstants';
import type { AuditFocus } from '@/lib/audit-focus';
import {
    filterCreativesByActiveCampaign,
    filterCreativeIdsByKnownCampaignStatus,
} from '@/lib/creativeScope';

export interface BatchAuditSkipParams {
    companyId: string;
    creativeIds: string[];
    auditFocus: AuditFocus;
    policyId?: string | null;
    skipRecentHours?: number;
    integrationIds?: string[];
    /** When set, skips DB round-trip for active-campaign filter (page batch). */
    campaignStatusByCreativeId?: Map<string, string | null | undefined>;
}

export interface BatchAuditSkipResult {
    toAudit: string[];
    skippedRecent: number;
    skippedInactiveCampaign: number;
}

export function partitionCreativesForBatchAudit(
    creativeIds: string[],
    recentlyAuditedIds: Set<string>,
    skippedInactiveCampaign = 0,
): BatchAuditSkipResult {
    const toAudit = creativeIds.filter((id) => !recentlyAuditedIds.has(id));
    return {
        toAudit,
        skippedRecent: creativeIds.length - toAudit.length,
        skippedInactiveCampaign,
    };
}

export async function fetchRecentlyAuditedCreativeIds(
    supabase: SupabaseClient,
    params: BatchAuditSkipParams,
): Promise<Set<string>> {
    const { companyId, creativeIds, auditFocus, policyId, skipRecentHours = BATCH_SKIP_RECENT_HOURS } = params;
    if (!creativeIds.length || skipRecentHours <= 0) return new Set();

    const thresholdIso = new Date(Date.now() - skipRecentHours * 60 * 60 * 1000).toISOString();
    const uniqueIds = [...new Set(creativeIds)];

    let query = supabase
        .from('audits')
        .select('creative_id')
        .eq('company_id', companyId)
        .eq('audit_focus', auditFocus)
        .in('creative_id', uniqueIds)
        .gte('created_at', thresholdIso)
        .not('creative_id', 'is', null);

    if (policyId) {
        query = query.eq('policy_id', policyId);
    } else {
        query = query.is('policy_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    return new Set((data ?? []).map((row) => String(row.creative_id)).filter(Boolean));
}

async function filterByActiveCampaign(
    params: BatchAuditSkipParams,
): Promise<{ eligibleIds: string[]; skippedInactiveCampaign: number }> {
    const { companyId, creativeIds, integrationIds, campaignStatusByCreativeId } = params;
    if (!creativeIds.length) {
        return { eligibleIds: [], skippedInactiveCampaign: 0 };
    }

    let eligibleIds: string[];
    if (campaignStatusByCreativeId) {
        eligibleIds = filterCreativeIdsByKnownCampaignStatus(creativeIds, campaignStatusByCreativeId);
    } else {
        eligibleIds = await filterCreativesByActiveCampaign(companyId, creativeIds, integrationIds);
    }

    return {
        eligibleIds,
        skippedInactiveCampaign: creativeIds.length - eligibleIds.length,
    };
}

export async function filterCreativesForBatchAudit(
    supabase: SupabaseClient,
    params: BatchAuditSkipParams,
): Promise<BatchAuditSkipResult> {
    const { eligibleIds, skippedInactiveCampaign } = await filterByActiveCampaign(params);
    const recentlyAudited = await fetchRecentlyAuditedCreativeIds(supabase, {
        ...params,
        creativeIds: eligibleIds,
    });
    return partitionCreativesForBatchAudit(eligibleIds, recentlyAudited, skippedInactiveCampaign);
}
