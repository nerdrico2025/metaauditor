import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchActiveCampaignIds, filterCreativesByActiveCampaign } from '../_shared/activeCampaignScope.ts';
import { BATCH_SKIP_RECENT_HOURS } from '../_shared/auditConstants.ts';
import {
    allRequestedRulesCached,
    computeBrandingFingerprint,
    computePerformanceFingerprint,
    loadCachedEvaluations,
} from '../_shared/ruleEvaluationCache.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AuditFocus = 'performance' | 'branding';
type AnalysisMode = 'fast' | 'balanced' | 'full';
type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
type BatchAction = 'start' | 'process' | 'status';

interface BatchAuditRequest {
    action?: BatchAction;
    job_id?: string;
    campaign_id?: string;
    ad_set_id?: string;
    policy_id?: string;
    audit_focus?: AuditFocus;
    analysis_mode?: AnalysisMode;
    chunk_size?: number;
    skip_recent_hours?: number;
    creative_ids?: string[];
    creative_rule_ids?: string[];
    performance_rule_ids?: string[];
}

interface BatchAuditJob {
    id: string;
    company_id: string;
    status: JobStatus;
    total_candidates: number;
    processed: number;
    audited: number;
    failed: number;
    skipped_recent: number;
    skipped_cached?: number;
    evaluated_delta?: number;
    full_rerun?: number;
    offset: number;
    chunk_size: number;
    analysis_mode: AnalysisMode;
    audit_focus: AuditFocus;
    campaign_id: string | null;
    ad_set_id: string | null;
    policy_id: string | null;
    creative_ids: string[] | null;
    creative_rule_ids: string[] | null;
    performance_rule_ids: string[] | null;
    skip_recent_hours: number;
    errors: string[] | null;
    started_at: string;
    finished_at: string | null;
}

function asUuidArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function asArray(value: unknown): string[] {
    return asUuidArray(value);
}

function normalizeAnalysisMode(raw?: string): AnalysisMode {
    if (raw === 'fast' || raw === 'full') return raw;
    return 'balanced';
}

function resolveConcurrency(mode: AnalysisMode): number {
    if (mode === 'fast') return 4;
    if (mode === 'balanced') return 4;
    return 2;
}

async function resolveJobRuleScope(
    supabase: ReturnType<typeof createClient>,
    companyId: string,
    job: BatchAuditJob,
): Promise<{ ruleIds: string[]; kind: 'branding' | 'performance'; rules: Array<Record<string, unknown>> }> {
    const isBranding = job.audit_focus === 'branding';
    if (isBranding) {
        let q = supabase
            .from('creative_rules')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true);
        const filterIds = job.creative_rule_ids ?? [];
        if (filterIds.length > 0) q = q.in('id', filterIds);
        const { data } = await q;
        const rules = (data ?? []) as Array<Record<string, unknown>>;
        return { ruleIds: rules.map((r) => String(r.id)), kind: 'branding', rules };
    }

    let q = supabase
        .from('automation_rules')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active');
    const filterIds = job.performance_rule_ids ?? [];
    if (filterIds.length > 0) q = q.in('id', filterIds);
    const { data } = await q;
    const rules = (data ?? []) as Array<Record<string, unknown>>;
    return { ruleIds: rules.map((r) => String(r.id)), kind: 'performance', rules };
}

async function classifyCreativeForBatchSkip(
    supabase: ReturnType<typeof createClient>,
    companyId: string,
    creative: Record<string, unknown>,
    job: BatchAuditJob,
    ruleScope: { ruleIds: string[]; kind: 'branding' | 'performance'; rules: Array<Record<string, unknown>> },
    skipPolicyId: string | null,
    thresholdIso: string | null,
): Promise<'skip_cached' | 'delta' | 'full'> {
    if (ruleScope.ruleIds.length === 0) return 'full';

    const fingerprintByRule = new Map<string, string>();
    for (const rule of ruleScope.rules) {
        const fp = ruleScope.kind === 'branding'
            ? computeBrandingFingerprint(rule, creative)
            : computePerformanceFingerprint(rule, creative);
        fingerprintByRule.set(String(rule.id), fp);
    }

    const cachedByRule = await loadCachedEvaluations(
        supabase,
        String(creative.id),
        ruleScope.ruleIds,
        ruleScope.kind,
    );

    const allCached = allRequestedRulesCached(ruleScope.ruleIds, cachedByRule, fingerprintByRule);
    if (!allCached) return 'full';

    if (!thresholdIso) return 'delta';

    let recentQuery = supabase
        .from('audits')
        .select('id')
        .eq('company_id', companyId)
        .eq('creative_id', String(creative.id))
        .eq('audit_focus', job.audit_focus)
        .gte('created_at', thresholdIso)
        .limit(1);

    if (skipPolicyId) {
        recentQuery = recentQuery.eq('policy_id', skipPolicyId);
    } else {
        recentQuery = recentQuery.is('policy_id', null);
    }

    const { data: recentAudit } = await recentQuery.maybeSingle();
    return recentAudit ? 'skip_cached' : 'delta';
}

async function fetchTotalCandidates(
    supabase: ReturnType<typeof createClient>,
    companyId: string,
    campaignId?: string,
    adSetId?: string,
    creativeIds?: string[],
) {
    const activeCampaignIds = await fetchActiveCampaignIds(supabase, companyId);

    if (creativeIds?.length) {
        const unique = [...new Set(creativeIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 50);
        const filtered = await filterCreativesByActiveCampaign(supabase, companyId, unique);
        return { total: filtered.length, normalizedCreativeIds: filtered };
    }

    if (activeCampaignIds.length === 0) {
        return { total: 0, normalizedCreativeIds: null };
    }

    if (campaignId && !activeCampaignIds.includes(campaignId)) {
        return { total: 0, normalizedCreativeIds: null };
    }

    let countQuery = supabase
        .from('creatives')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .ilike('status', 'active')
        .in('campaign_id', activeCampaignIds);

    if (campaignId) countQuery = countQuery.eq('campaign_id', campaignId);
    if (adSetId) countQuery = countQuery.eq('ad_set_id', adSetId);
    const countRes = await countQuery;
    if (countRes.error) throw new Error('Failed to count active creatives');
    return { total: countRes.count || 0, normalizedCreativeIds: null };
}

async function fetchChunkCandidates(
    supabase: ReturnType<typeof createClient>,
    companyId: string,
    job: BatchAuditJob,
) {
    const chunkSize = Math.min(Math.max(1, Number(job.chunk_size) || 8), 30);
    const offset = Math.max(0, Number(job.offset) || 0);
    const activeCampaignIds = await fetchActiveCampaignIds(supabase, companyId);

    if (activeCampaignIds.length === 0) {
        return { creatives: [] as { id: string; spend: number | null }[], nextOffset: offset + chunkSize };
    }

    if (job.creative_ids?.length) {
        const idsChunk = job.creative_ids.slice(offset, offset + chunkSize);
        if (!idsChunk.length) return { creatives: [] as { id: string; spend: number | null }[], nextOffset: offset + chunkSize };
        const { data, error } = await supabase
            .from('creatives')
            .select('id, spend')
            .eq('company_id', companyId)
            .in('id', idsChunk)
            .in('campaign_id', activeCampaignIds);
        if (error) throw new Error('Failed to fetch creative chunk by ids');
        const sorted = data
            ? [...data].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0))
            : [];
        return { creatives: sorted, nextOffset: offset + chunkSize };
    }

    if (job.campaign_id && !activeCampaignIds.includes(job.campaign_id)) {
        return { creatives: [] as { id: string; spend: number | null }[], nextOffset: offset + chunkSize };
    }

    let query = supabase
        .from('creatives')
        .select('id, spend')
        .eq('company_id', companyId)
        .ilike('status', 'active')
        .in('campaign_id', activeCampaignIds)
        .order('spend', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(offset, offset + chunkSize - 1);

    if (job.campaign_id) query = query.eq('campaign_id', job.campaign_id);
    if (job.ad_set_id) query = query.eq('ad_set_id', job.ad_set_id);
    const res = await query;
    if (res.error) throw new Error('Failed to fetch active creative chunk');
    return { creatives: res.data || [], nextOffset: offset + chunkSize };
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing authorization header');

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();
        if (!userData?.company_id) throw new Error('User not associated with company');

        const body = await req.json() as BatchAuditRequest;
        const action: BatchAction = body.action || 'process';

        if (action === 'start') {
            const auditFocus: AuditFocus = body.audit_focus === 'branding' ? 'branding' : 'performance';
            const normalizedChunkSize = Math.min(Math.max(1, Number(body.chunk_size) || 8), 30);
            const skipRecentHours = Math.max(0, Number(body.skip_recent_hours) || BATCH_SKIP_RECENT_HOURS);

            const { total, normalizedCreativeIds } = await fetchTotalCandidates(
                supabase,
                userData.company_id,
                body.campaign_id,
                body.ad_set_id,
                body.creative_ids,
            );

            let analysisMode = normalizeAnalysisMode(body.analysis_mode);
            if (total > 30 && analysisMode === 'balanced') {
                analysisMode = 'fast';
            }

            const { data: createdJob, error: createJobError } = await supabase
                .from('batch_audit_jobs')
                .insert({
                    company_id: userData.company_id,
                    status: 'running',
                    total_candidates: total,
                    processed: 0,
                    audited: 0,
                    failed: 0,
                    skipped_recent: 0,
                    offset: 0,
                    chunk_size: normalizedChunkSize,
                    analysis_mode: analysisMode,
                    audit_focus: auditFocus,
                    campaign_id: body.campaign_id || null,
                    ad_set_id: body.ad_set_id || null,
                    policy_id: body.policy_id || null,
                    creative_ids: normalizedCreativeIds,
                    creative_rule_ids: asUuidArray(body.creative_rule_ids),
                    performance_rule_ids: asUuidArray(body.performance_rule_ids),
                    skip_recent_hours: skipRecentHours,
                    errors: [],
                    started_at: new Date().toISOString(),
                })
                .select('*')
                .single();

            if (createJobError || !createdJob) throw new Error('Failed to create batch audit job');

            return new Response(
                JSON.stringify({
                    success: true,
                    job: createdJob,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
            );
        }

        if (!body.job_id) throw new Error('Missing job_id');

        const { data: job, error: jobError } = await supabase
            .from('batch_audit_jobs')
            .select('*')
            .eq('id', body.job_id)
            .eq('company_id', userData.company_id)
            .single();
        if (jobError || !job) throw new Error('Batch job not found');

        if (action === 'status' || job.status === 'completed' || job.status === 'failed') {
            return new Response(
                JSON.stringify({ success: true, job }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
            );
        }

        const typedJob = {
            ...job,
            creative_ids: asArray(job.creative_ids),
            creative_rule_ids: asArray(job.creative_rule_ids),
            performance_rule_ids: asArray(job.performance_rule_ids),
            errors: asArray(job.errors),
        } as BatchAuditJob;

        const { creatives, nextOffset } = await fetchChunkCandidates(supabase, userData.company_id, typedJob);
        const hasMoreCandidates = nextOffset < typedJob.total_candidates;

        if (!creatives.length) {
            const finished = !hasMoreCandidates;
            const updatePayload = {
                offset: nextOffset,
                processed: Math.min(nextOffset, typedJob.total_candidates),
                status: finished ? 'completed' as JobStatus : 'running' as JobStatus,
                finished_at: finished ? new Date().toISOString() : null,
            };

            const { data: updatedJob, error: updateError } = await supabase
                .from('batch_audit_jobs')
                .update(updatePayload)
                .eq('id', typedJob.id)
                .select('*')
                .single();
            if (updateError || !updatedJob) throw new Error('Failed to update empty chunk job status');

            return new Response(
                JSON.stringify({ success: true, job: updatedJob, processed_in_chunk: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
            );
        }

        const skipWindowHours = Math.max(0, Number(typedJob.skip_recent_hours) || 0);
        const creativeIdsInChunk = creatives.map((c) => c.id);
        let skipPolicyId = typedJob.policy_id;
        if (!skipPolicyId) {
            const { data: defaultPolicy } = await supabase
                .from('policies')
                .select('id')
                .eq('company_id', userData.company_id)
                .eq('is_default', true)
                .maybeSingle();
            skipPolicyId = defaultPolicy?.id ?? null;
        }

        const thresholdIso = skipWindowHours > 0
            ? new Date(Date.now() - skipWindowHours * 60 * 60 * 1000).toISOString()
            : null;

        const ruleScope = await resolveJobRuleScope(supabase, userData.company_id, typedJob);

        const skipClassByCreative = new Map<string, 'skip_cached' | 'delta' | 'full'>();
        for (const creative of creatives) {
            const classification = await classifyCreativeForBatchSkip(
                supabase,
                userData.company_id,
                creative as Record<string, unknown>,
                typedJob,
                ruleScope,
                skipPolicyId,
                thresholdIso,
            );
            skipClassByCreative.set(creative.id, classification);
        }

        const toAudit = creatives.filter((c) => skipClassByCreative.get(c.id) !== 'skip_cached');
        const chunkSkippedCached = creatives.filter((c) => skipClassByCreative.get(c.id) === 'skip_cached').length;
        const chunkEvaluatedDelta = creatives.filter((c) => skipClassByCreative.get(c.id) === 'delta').length;
        const chunkFullRerun = creatives.filter((c) => skipClassByCreative.get(c.id) === 'full').length;

        const isBranding = typedJob.audit_focus === 'branding';
        const creativeRuleIds = typedJob.creative_rule_ids ?? [];
        const performanceRuleIds = typedJob.performance_rule_ids ?? [];
        let hasActiveRules = false;
        if (isBranding) {
            let rulesQuery = supabase
                .from('creative_rules')
                .select('id')
                .eq('company_id', userData.company_id)
                .eq('is_active', true);
            if (creativeRuleIds.length > 0) {
                rulesQuery = rulesQuery.in('id', creativeRuleIds);
            }
            const { data: activeRules } = await rulesQuery.limit(1);
            hasActiveRules = (activeRules?.length || 0) > 0;
        }

        const auditUrl = `${supabaseUrl}/functions/v1/audit-creative`;
        const rulesCheckUrl = `${supabaseUrl}/functions/v1/check-creative-rules`;
        const errors = [...typedJob.errors];
        let chunkAudited = 0;
        let chunkFailed = 0;
        let chunkRulesChecked = 0;
        let chunkSkippedRecent = chunkSkippedCached;
        const concurrency = resolveConcurrency(typedJob.analysis_mode);

        for (let i = 0; i < toAudit.length; i += concurrency) {
            const batch = toAudit.slice(i, i + concurrency);
            await Promise.all(batch.map(async (creative) => {
                try {
                    const response = await fetch(auditUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': authHeader,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            creative_id: creative.id,
                            policy_id: typedJob.policy_id,
                            audit_focus: typedJob.audit_focus,
                            analysis_mode: typedJob.analysis_mode,
                            batch_context: true,
                            ...(isBranding && creativeRuleIds.length > 0
                                ? { rule_ids: creativeRuleIds }
                                : {}),
                            ...(!isBranding && performanceRuleIds.length > 0
                                ? { performance_rule_ids: performanceRuleIds }
                                : {}),
                        }),
                    });
                    if (response.ok) {
                        chunkAudited++;
                    } else {
                        chunkFailed++;
                        try {
                            const errorData = await response.json();
                            errors.push(`${creative.id}: ${errorData.error || `HTTP ${response.status}`}`);
                        } catch {
                            errors.push(`${creative.id}: HTTP ${response.status}`);
                        }
                    }
                } catch (error) {
                    chunkFailed++;
                    errors.push(`${creative.id}: ${String(error)}`);
                }

                if (hasActiveRules) {
                    try {
                        const rulesResp = await fetch(rulesCheckUrl, {
                            method: 'POST',
                            headers: {
                                'Authorization': authHeader,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                creative_id: creative.id,
                                ...(creativeRuleIds.length > 0 ? { rule_ids: creativeRuleIds } : {}),
                            }),
                        });
                        if (rulesResp.ok) chunkRulesChecked++;
                    } catch (_) {
                        // non-critical
                    }
                }
            }));
        }

        const newProcessed = Math.min(nextOffset, typedJob.total_candidates);
        const finished = !hasMoreCandidates;

        const { data: updatedJob, error: updateError } = await supabase
            .from('batch_audit_jobs')
            .update({
                status: finished ? 'completed' : 'running',
                processed: newProcessed,
                audited: Number(typedJob.audited) + chunkAudited,
                failed: Number(typedJob.failed) + chunkFailed,
                skipped_recent: Number(typedJob.skipped_recent) + chunkSkippedRecent,
                skipped_cached: Number(typedJob.skipped_cached ?? 0) + chunkSkippedCached,
                evaluated_delta: Number(typedJob.evaluated_delta ?? 0) + chunkEvaluatedDelta,
                full_rerun: Number(typedJob.full_rerun ?? 0) + chunkFullRerun,
                offset: nextOffset,
                errors: errors.slice(-30),
                finished_at: finished ? new Date().toISOString() : null,
            })
            .eq('id', typedJob.id)
            .select('*')
            .single();
        if (updateError || !updatedJob) throw new Error('Failed to update batch audit job progress');

        if (finished) {
            await supabase.from('sync_history').insert({
                company_id: userData.company_id,
                sync_type: 'batch_audit',
                status: 'completed',
                records_synced: updatedJob.audited,
                details: {
                    job_id: updatedJob.id,
                    total_candidates: updatedJob.total_candidates,
                    processed: updatedJob.processed,
                    audited: updatedJob.audited,
                    failed: updatedJob.failed,
                    skipped_recent: updatedJob.skipped_recent,
                    rules_checked: chunkRulesChecked,
                    analysis_mode: updatedJob.analysis_mode,
                    audit_focus: updatedJob.audit_focus,
                    campaign_id: updatedJob.campaign_id,
                    policy_id: updatedJob.policy_id,
                },
            });
        }

        return new Response(
            JSON.stringify({
                success: true,
                job: updatedJob,
                processed_in_chunk: creatives.length,
                rules_checked_in_chunk: chunkRulesChecked,
                errors: errors.slice(-5),
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        );
    } catch (error) {
        console.error('Batch audit error:', error);
        return new Response(
            JSON.stringify({ success: false, error: String(error) }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        );
    }
});
