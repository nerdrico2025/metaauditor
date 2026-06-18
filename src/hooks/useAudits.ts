import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';
import type { AuditFocus } from '@/lib/audit-focus';
import { BATCH_SKIP_RECENT_HOURS } from '@/config/auditConstants';

export interface Audit {
    id: string;
    company_id: string;
    creative_id: string | null;
    campaign_id?: string | null;
    ad_set_id?: string | null;
    audit_level?: string | null;
    policy_id: string | null;
    audit_focus?: string | null;
    status: string | null;
    compliance_score: number | null;
    performance_score: number | null;
    issues: AuditIssue[] | null;
    recommendations: string[] | null;
    ai_analysis: AiAnalysis | null;
    created_at: string;
    // Joined data
    creatives?: {
        name: string;
        image_url: string | null;
        type: string | null;
        spend: number | null;
        status: string | null;
        impressions: number | null;
        clicks: number | null;
        ctr: number | null;
        cpc: number | null;
        conversions: number | null;
        external_id: string | null;
        campaign_id?: string | null;
        ad_set_id?: string | null;
        campaigns?: {
            id: string;
            name: string;
            external_id?: string | null;
            daily_budget?: number | null;
            status?: string | null;
            integration_id?: string | null;
        };
        ad_sets?: {
            id: string;
            name: string;
        };
    };
    creative?: {
        name: string;
        image_url: string | null;
    };
    policies?: {
        name: string;
    };
    campaigns?: {
        id: string;
        name: string;
    };
    ad_sets?: {
        id: string;
        name: string;
    };
}

export interface AuditIssue {
    type: 'keyword' | 'text_length' | 'brand' | 'performance';
    severity: 'error' | 'warning' | 'info';
    message: string;
    details?: Record<string, unknown>;
}

export interface AiAnalysis {
    overall_score?: number;
    quality_score?: number;
    hook_score?: number;
    value_proposition_score?: number;
    persuasion_score?: number;
    visual_score?: number;
    cta_score?: number;
    social_proof_score?: number;
    urgency_score?: number;
    target_alignment_score?: number;
    tone_analysis?: string;
    executive_summary?: string;
    error?: string;
    score_breakdown?: {
        ai_overall?: number | null;
        policy_compliance?: number;
        performance_metrics?: number;
        performance_rules_pass_rate?: number | null;
        creative_rules_pass_rate?: number | null;
        audit_focus?: AuditFocus;
    };
    audit_focus?: AuditFocus;
    performance_rules_compliance?: Array<{ rule_name: string; passed: boolean; reason: string }>;
    strengths?: string[];
    weaknesses?: string[];
    suggestions?: string[];
    persuasion_triggers_found?: string[];
    persuasion_triggers_missing?: string[];
    visual_analysis?: {
        contrast_readability?: number;
        information_hierarchy?: number;
        mobile_optimization?: number;
        text_overlay_ratio?: string;
        has_human_face?: boolean;
        composition_notes?: string;
    };
    performance_diagnosis?: string;
    scaling_recommendation?: string;
    action_plan?: string[];
    policy_warnings?: string[];
    rules_compliance?: Array<{ rule_name: string; passed: boolean; reason: string }>;
}

export type BatchAnalysisMode = 'fast' | 'balanced' | 'full';
export type BatchAuditAction = 'start' | 'process' | 'status';

export interface BatchAuditJob {
    id: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    total_candidates: number;
    processed: number;
    audited: number;
    failed: number;
    skipped_recent: number;
}

const AUDITS_LIST_COLUMNS = `
  id, company_id, creative_id, campaign_id, ad_set_id, audit_level, policy_id, audit_focus,
  status, compliance_score, performance_score, issues, recommendations, created_at
`;

export { AUDITS_LIST_COLUMNS };

const AUDITS_LIST_SELECT = `
  ${AUDITS_LIST_COLUMNS},
  creatives(name, image_url, type, spend, status, impressions, clicks, ctr, cpc, conversions, external_id, campaign_id, ad_set_id, campaigns(id, name, external_id, daily_budget, status, integration_id), ad_sets(id, name)),
  policies(name)
`;

const AUDITS_DETAIL_SELECT = `
  *,
  creatives(name, image_url, type, spend, status, impressions, clicks, ctr, cpc, conversions, external_id, campaign_id, ad_set_id, campaigns(id, name, external_id, daily_budget, status, integration_id), ad_sets(id, name)),
  policies(name)
`;

export function useAuditDetail(auditId: string | null | undefined, companyId?: string | null) {
    return useQuery({
        queryKey: ['audit-detail', auditId, companyId],
        queryFn: async () => {
            if (!auditId) throw new Error('No audit ID');
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('audits')
                .select(AUDITS_DETAIL_SELECT)
                .eq('id', auditId)
                .eq('company_id', companyId)
                .single();

            if (error) throw error;
            return data as unknown as Audit;
        },
        enabled: !!auditId && !!companyId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useAudits(auditFocus?: AuditFocus) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company?.id ?? user?.company_id;

    const auditsQuery = useQuery({
        queryKey: ['audits', companyId, auditFocus ?? 'all'],
        queryFn: async () => {
            if (!companyId) throw new Error('No company ID');

            let query = supabase
                .from('audits')
                .select(AUDITS_LIST_SELECT)
                .eq('company_id', companyId)
                .eq('audit_level', 'creative')
                .not('creative_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(100);

            if (auditFocus) {
                query = query.eq('audit_focus', auditFocus);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as unknown as Audit[];
        },
        enabled: !!companyId,
    });

    const runAudit = useMutation({
        mutationFn: async ({
            creativeId,
            policyId,
            auditFocus = 'performance',
            ruleIds,
            performanceRuleIds,
            forceRefresh,
        }: {
            creativeId: string;
            policyId?: string;
            auditFocus?: AuditFocus;
            ruleIds?: string[];
            performanceRuleIds?: string[];
            forceRefresh?: boolean;
        }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch(
                `${supabaseUrl}/functions/v1/audit-creative`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        creative_id: creativeId,
                        policy_id: policyId,
                        audit_focus: auditFocus,
                        ...(ruleIds?.length ? { rule_ids: ruleIds } : {}),
                        ...(performanceRuleIds?.length ? { performance_rule_ids: performanceRuleIds } : {}),
                        ...(forceRefresh ? { force_refresh: true } : {}),
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Audit failed');
            }

            const result = await response.json();
            void logActivity({
                eventType: 'action',
                action: 'audit.creative',
                resourceType: 'creative',
                resourceId: creativeId,
                metadata: { audit_focus: auditFocus, policy_id: policyId },
            });
            return result;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['audits', companyId] });
            queryClient.invalidateQueries({ queryKey: ['creative-rule-evaluations'] });
            const cached = Number(data?.cached_rules ?? 0);
            const evaluated = Number(data?.evaluated_rules ?? 0);
            if (data?.llm_skipped) {
                toast.success('Auditoria reutilizada do cache (sem nova chamada à IA)');
            } else if (cached > 0 && evaluated > 0) {
                toast.success(`Auditoria concluída — ${cached} regra(s) reutilizadas, ${evaluated} analisada(s) agora`);
            } else if (cached > 0) {
                toast.success(`Auditoria concluída — ${cached} regra(s) reutilizadas do cache`);
            } else {
                toast.success('Auditoria concluída');
            }
        },
        onError: (error) => {
            toast.error(`Erro na auditoria: ${error.message}`);
        },
    });

    const runBatchAudit = useMutation({
        mutationFn: async ({
            action = 'process',
            jobId,
            campaignId,
            adSetId,
            policyId,
            auditFocus = 'performance',
            analysisMode = 'balanced',
            chunkSize,
            skipRecentHours,
            creativeRuleIds,
            performanceRuleIds,
            creativeIds,
        }: {
            action?: BatchAuditAction;
            jobId?: string;
            campaignId?: string;
            adSetId?: string;
            policyId?: string;
            auditFocus?: AuditFocus;
            analysisMode?: BatchAnalysisMode;
            chunkSize?: number;
            skipRecentHours?: number;
            creativeRuleIds?: string[];
            performanceRuleIds?: string[];
            creativeIds?: string[];
        }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch(
                `${supabaseUrl}/functions/v1/audit-batch`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action,
                        job_id: jobId,
                        campaign_id: campaignId,
                        ad_set_id: adSetId,
                        policy_id: policyId,
                        audit_focus: auditFocus,
                        analysis_mode: analysisMode,
                        chunk_size: chunkSize,
                        skip_recent_hours: skipRecentHours ?? BATCH_SKIP_RECENT_HOURS,
                        ...(creativeRuleIds?.length ? { creative_rule_ids: creativeRuleIds } : {}),
                        ...(performanceRuleIds?.length ? { performance_rule_ids: performanceRuleIds } : {}),
                        ...(creativeIds?.length ? { creative_ids: creativeIds } : {}),
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Batch audit failed');
            }

            const result = await response.json();
            if (action !== 'status') {
                void logActivity({
                    eventType: 'action',
                    action: 'audit.batch',
                    metadata: {
                        campaign_id: campaignId,
                        ad_set_id: adSetId,
                        audit_focus: auditFocus,
                        creative_count: creativeIds?.length,
                    },
                });
            }
            return result;
        },
        onError: (error) => {
            toast.error(`Erro na auditoria em lote: ${error.message}`);
        },
    });

    const invalidateAudits = () => {
        queryClient.invalidateQueries({ queryKey: ['audits', companyId] });
    };

    return {
        audits: auditsQuery.data || [],
        isLoading: auditsQuery.isLoading,
        error: auditsQuery.error,
        runAudit,
        runBatchAudit,
        invalidateAudits,
    };
}

export function useAuditsCount() {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['audits-count', companyId],
        queryFn: async () => {
            if (!companyId) throw new Error('No company ID');

            const { count: total, error: totalError } = await supabase
                .from('audits')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId);

            if (totalError) throw totalError;

            const { count: pending, error: pendingError } = await supabase
                .from('audits')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .eq('status', 'pending');

            if (pendingError) throw pendingError;

            return {
                total: total || 0,
                pending: pending || 0
            };
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useRecentAudits(limit: number = 5, auditFocus?: AuditFocus) {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['recent-audits', companyId, limit, auditFocus ?? 'all'],
        queryFn: async () => {
            if (!companyId) throw new Error('No company ID');

            let query = supabase
                .from('audits')
                .select(`
                    id, company_id, creative_id, status, compliance_score, performance_score,
                    audit_focus, created_at, issues,
                    creative:creatives(name, image_url)
                `)
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (auditFocus) {
                query = query.eq('audit_focus', auditFocus);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useIssuesWithHighPriority(limit: number = 5, auditFocus?: AuditFocus) {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['high-priority-issues', companyId, limit, auditFocus ?? 'all'],
        queryFn: async () => {
            if (!companyId) throw new Error('No company ID');

            let query = supabase
                .from('audits')
                .select(`
                    id, company_id, creative_id, status, compliance_score, performance_score,
                    audit_focus, created_at, issues,
                    creative:creatives(name, image_url)
                `)
                .eq('company_id', companyId)
                .eq('status', 'rejected')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (auditFocus) {
                query = query.eq('audit_focus', auditFocus);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
    });
}
