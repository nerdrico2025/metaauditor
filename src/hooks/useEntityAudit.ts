import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { toast } from 'sonner';
import type { Audit } from '@/hooks/useAudits';
import { BATCH_SKIP_RECENT_HOURS } from '@/config/auditConstants';

export type EntityAuditLevel = 'campaign' | 'ad_set';
export type PerformanceBatchScope = 'entities' | 'creatives' | 'both';

interface EntityAuditResponse {
    success: boolean;
    audit: Audit;
    cached?: boolean;
}

interface BatchJob {
    id: string;
    status: string;
    total_candidates: number;
    processed: number;
    audited: number;
    failed: number;
    skipped_recent: number;
}

async function getSessionToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sessão expirada. Faça login novamente.');
    return session.access_token;
}

const ENTITY_AUDITS_HISTORY_SELECT = `
    *,
    campaigns(id, name),
    ad_sets(id, name)
`;

export function useEntityAuditsHistory() {
    const { user } = useAuth();
    const companyId = user?.company?.id ?? user?.company_id;

    return useQuery({
        queryKey: ['entity-audits-history', companyId],
        queryFn: async (): Promise<Audit[]> => {
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('audits')
                .select(ENTITY_AUDITS_HISTORY_SELECT)
                .eq('company_id', companyId)
                .eq('audit_focus', 'performance')
                .in('audit_level', ['campaign', 'ad_set'])
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            return data as unknown as Audit[];
        },
        enabled: !!companyId,
    });
}

export function useLatestEntityAudit(
    entityId: string | undefined,
    level: EntityAuditLevel,
) {
    const { user } = useAuth();
    const companyId = user?.company?.id ?? user?.company_id;

    return useQuery({
        queryKey: ['entity-audit', level, entityId, companyId],
        queryFn: async (): Promise<Audit | null> => {
            if (!entityId || !companyId) return null;

            let query = supabase
                .from('audits')
                .select('*')
                .eq('company_id', companyId)
                .eq('audit_level', level)
                .eq('audit_focus', 'performance')
                .order('created_at', { ascending: false })
                .limit(1);

            if (level === 'campaign') {
                query = query.eq('campaign_id', entityId);
            } else {
                query = query.eq('ad_set_id', entityId);
            }

            const { data, error } = await query.maybeSingle();
            if (error) throw error;
            return data as Audit | null;
        },
        enabled: !!entityId && !!companyId,
        staleTime: 60_000,
    });
}

export function useEntityAudit() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const companyId = user?.company?.id ?? user?.company_id;
    const { range: dateRange } = useDateFilter();

    const datePayload = {
        date_start: dateRange.isAll ? undefined : dateRange.startDate,
        date_end: dateRange.isAll ? undefined : dateRange.endDate,
    };

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['entity-audit'] });
        queryClient.invalidateQueries({ queryKey: ['entity-audits-history'] });
        queryClient.invalidateQueries({ queryKey: ['audits', companyId] });
    };

    const runCampaignAudit = useMutation({
        mutationFn: async ({
            campaignId,
            forceRefresh,
            performanceRuleIds,
        }: {
            campaignId: string;
            forceRefresh?: boolean;
            performanceRuleIds?: string[];
        }) => {
            const token = await getSessionToken();
            const response = await fetch(`${supabaseUrl}/functions/v1/audit-campaign`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    campaign_id: campaignId,
                    force_refresh: forceRefresh,
                    ...datePayload,
                    ...(performanceRuleIds?.length ? { performance_rule_ids: performanceRuleIds } : {}),
                }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Falha na auditoria da campanha');
            }
            return response.json() as Promise<EntityAuditResponse>;
        },
        onSuccess: (data) => {
            invalidate();
            toast.success(data.cached ? 'Diagnóstico recente reutilizado' : 'Análise de campanha concluída');
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const runAdSetAudit = useMutation({
        mutationFn: async ({
            adSetId,
            forceRefresh,
            performanceRuleIds,
        }: {
            adSetId: string;
            forceRefresh?: boolean;
            performanceRuleIds?: string[];
        }) => {
            const token = await getSessionToken();
            const response = await fetch(`${supabaseUrl}/functions/v1/audit-ad-set`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ad_set_id: adSetId,
                    force_refresh: forceRefresh,
                    ...datePayload,
                    ...(performanceRuleIds?.length ? { performance_rule_ids: performanceRuleIds } : {}),
                }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Falha na auditoria do conjunto');
            }
            return response.json() as Promise<EntityAuditResponse>;
        },
        onSuccess: (data) => {
            invalidate();
            toast.success(data.cached ? 'Diagnóstico recente reutilizado' : 'Análise de conjunto concluída');
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const runCreativesBatch = useMutation({
        mutationFn: async ({
            campaignId,
            adSetId,
            performanceRuleIds,
            creativeIds,
            onProgress,
        }: {
            campaignId?: string;
            adSetId?: string;
            performanceRuleIds?: string[];
            creativeIds?: string[];
            onProgress?: (job: BatchJob) => void;
        }) => {
            const token = await getSessionToken();

            const startRes = await fetch(`${supabaseUrl}/functions/v1/audit-batch`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'start',
                    campaign_id: campaignId,
                    ad_set_id: adSetId,
                    audit_focus: 'performance',
                    analysis_mode: 'balanced',
                    chunk_size: 8,
                    skip_recent_hours: BATCH_SKIP_RECENT_HOURS,
                    ...(performanceRuleIds?.length ? { performance_rule_ids: performanceRuleIds } : {}),
                    ...(creativeIds?.length ? { creative_ids: creativeIds } : {}),
                }),
            });
            if (!startRes.ok) {
                const err = await startRes.json().catch(() => ({}));
                throw new Error(err.error || 'Falha ao iniciar lote de criativos');
            }
            const started = await startRes.json() as { job?: BatchJob };
            const jobId = started.job?.id;
            if (!jobId) throw new Error('Job de lote inválido');

            let job = started.job!;
            onProgress?.(job);

            while (job.status === 'running' || job.status === 'queued') {
                const procRes = await fetch(`${supabaseUrl}/functions/v1/audit-batch`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'process', job_id: jobId }),
                });
                if (!procRes.ok) {
                    const err = await procRes.json().catch(() => ({}));
                    throw new Error(err.error || 'Falha ao processar lote');
                }
                const result = await procRes.json() as { job?: BatchJob };
                job = result.job!;
                onProgress?.(job);
                if (job.status === 'failed') throw new Error('Lote de criativos falhou');
                if (job.status !== 'completed') {
                    await new Promise((r) => setTimeout(r, 200));
                }
            }

            return job;
        },
        onSuccess: () => {
            invalidate();
            toast.success('Auditoria de criativos concluída');
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const runEntityQueue = useMutation({
        mutationFn: async ({
            ids,
            level,
            performanceRuleIds,
            onItemDone,
        }: {
            ids: string[];
            level: EntityAuditLevel;
            performanceRuleIds?: string[];
            onItemDone?: (index: number, total: number) => void;
        }) => {
            const token = await getSessionToken();
            const endpoint = level === 'campaign' ? 'audit-campaign' : 'audit-ad-set';
            const audits: Audit[] = [];

            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                const body = level === 'campaign'
                    ? {
                        campaign_id: id,
                        ...datePayload,
                        ...(performanceRuleIds?.length ? { performance_rule_ids: performanceRuleIds } : {}),
                    }
                    : {
                        ad_set_id: id,
                        ...datePayload,
                        ...(performanceRuleIds?.length ? { performance_rule_ids: performanceRuleIds } : {}),
                    };

                const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                });
                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || `Falha na auditoria (${i + 1}/${ids.length})`);
                }
                const result = await response.json() as EntityAuditResponse;
                audits.push(result.audit);
                onItemDone?.(i + 1, ids.length);
            }

            invalidate();
            return audits;
        },
        onSuccess: (_, { ids }) => {
            toast.success(`${ids.length} análise(s) de entidade concluída(s)`);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return {
        runCampaignAudit,
        runAdSetAudit,
        runCreativesBatch,
        runEntityQueue,
        datePayload,
    };
}
