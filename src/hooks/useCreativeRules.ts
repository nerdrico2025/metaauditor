import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { friendlyEdgeFunctionError, parseSupabaseFunctionError } from '@/lib/edgeFunctionErrors';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { integrationIdsKey, type MonitoredCampaignScope } from '@/hooks/useMonitoredCampaignScope';

export interface CreativeRule {
    id: string;
    company_id: string;
    name: string;
    description?: string;
    rule_type: 'content' | 'structure' | 'copy' | 'visual';
    rule_definition: string;
    applies_to: 'all' | 'video' | 'image' | 'carousel';
    severity: 'error' | 'warning' | 'info';
    is_active: boolean;
    /** Brand logo uploaded for this rule (visual rules with logo_required). */
    logo_url?: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreativeRuleCheckResult {
    rule_id: string;
    rule_name: string;
    rule_type: string;
    severity: string;
    passed: boolean;
    reason: string;
}

export interface CreativeRuleCheck {
    id: string;
    company_id: string;
    creative_id: string;
    checked_at: string;
    overall_status: 'approved' | 'warning' | 'rejected';
    overall_score: number;
    results: CreativeRuleCheckResult[];
    ai_summary: string;
}

export type CreateCreativeRuleData = Omit<CreativeRule, 'id' | 'company_id' | 'created_at' | 'updated_at'>;

export function useCreativeRules() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company?.id;

    const { data: rules, isLoading, error } = useQuery({
        queryKey: ['creative-rules', companyId],
        queryFn: async () => {
            if (!companyId) throw new Error('Company ID not found');
            const { data, error } = await supabase
                .from('creative_rules')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as CreativeRule[];
        },
        enabled: !!companyId,
    });

    const createRule = useMutation({
        mutationFn: async (newRule: CreateCreativeRuleData) => {
            if (!companyId) throw new Error('Company ID not found');
            const { data, error } = await supabase
                .from('creative_rules')
                .insert([{ ...newRule, company_id: companyId }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['creative-rules', companyId] });
            queryClient.invalidateQueries({ queryKey: ['compliance-summary'] });
            toast.success('Regra de criativo criada!');
        },
        onError: (error: Error) => {
            toast.error(`Erro ao criar regra: ${error.message}`);
        },
    });

    const updateRule = useMutation({
        mutationFn: async ({ id, ...updates }: Partial<CreateCreativeRuleData> & { id: string }) => {
            const { data, error } = await supabase
                .from('creative_rules')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['creative-rules', companyId] });
            queryClient.invalidateQueries({ queryKey: ['compliance-summary'] });
            toast.success('Regra atualizada!');
        },
        onError: (error: Error) => {
            toast.error(`Erro ao atualizar regra: ${error.message}`);
        },
    });

    const deleteRule = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('creative_rules')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['creative-rules', companyId] });
            queryClient.invalidateQueries({ queryKey: ['compliance-summary'] });
            toast.success('Regra excluída.');
        },
        onError: (error: Error) => {
            toast.error(`Erro ao excluir regra: ${error.message}`);
        },
    });

    const toggleRule = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { error } = await supabase
                .from('creative_rules')
                .update({ is_active: !is_active })
                .eq('id', id);
            if (error) throw error;
            return !is_active;
        },
        onSuccess: (newState) => {
            queryClient.invalidateQueries({ queryKey: ['creative-rules', companyId] });
            queryClient.invalidateQueries({ queryKey: ['compliance-summary'] });
            toast.success(`Regra ${newState ? 'ativada' : 'pausada'}!`);
        },
        onError: (error: Error) => {
            toast.error(`Erro ao alterar status: ${error.message}`);
        },
    });

    return { rules, isLoading, error, createRule, updateRule, deleteRule, toggleRule };
}

export function useCreativeRuleCheck(creativeId: string | null) {
    const { user } = useAuth();
    const companyId = user?.company?.id;
    const queryClient = useQueryClient();

    const { data: lastCheck, isLoading } = useQuery({
        queryKey: ['creative-rule-check', creativeId],
        queryFn: async () => {
            if (!creativeId || !companyId) return null;
            const { data } = await supabase
                .from('creative_rule_checks')
                .select('*')
                .eq('creative_id', creativeId)
                .eq('company_id', companyId)
                .order('checked_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data as CreativeRuleCheck | null;
        },
        enabled: !!creativeId && !!companyId,
    });

    const runCheck = useMutation({
        mutationFn: async (params: string | { creative_id: string; rule_ids?: string[]; force?: boolean }) => {
            const body = typeof params === 'string'
                ? { creative_id: params }
                : {
                    creative_id: params.creative_id,
                    rule_ids: params.rule_ids,
                    ...(params.force ? { force: true } : {}),
                };
            const response = await supabase.functions.invoke('check-creative-rules', {
                body,
            });

            if (response.error || !response.data?.success) {
                const detail = await parseSupabaseFunctionError(response.error, response.data);
                throw new Error(friendlyEdgeFunctionError(detail, 'Falha na verificação do criativo.'));
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['creative-rule-check', creativeId] });
            queryClient.invalidateQueries({ queryKey: ['creative-rule-checks-batch'] });
            queryClient.invalidateQueries({ queryKey: ['compliance-summary'] });
            queryClient.invalidateQueries({ queryKey: ['branding-compliance'] });
        },
        onError: (error: Error) => {
            toast.error(friendlyEdgeFunctionError(error.message, 'Erro na verificação. Tente novamente.'));
        },
    });

    return { lastCheck, isLoading, runCheck };
}

// Hook for dashboard compliance summary (fetches all checked creatives for the company)
export interface ComplianceSummaryData {
    total_checked: number;
    approved: number;
    warning: number;
    rejected: number;
    top_violated_rules: Array<{ rule_name: string; count: number; severity: string }>;
    non_compliant_creatives: Array<{
        creative_id: string;
        creative_name: string;
        overall_status: string;
        overall_score: number;
        failed_rules: Array<{ rule_name: string; severity: string; reason: string }>;
    }>;
}

const EMPTY_COMPLIANCE_SUMMARY: ComplianceSummaryData = {
    total_checked: 0,
    approved: 0,
    warning: 0,
    rejected: 0,
    top_violated_rules: [],
    non_compliant_creatives: [],
};

const CREATIVE_CHECKS_CHUNK_SIZE = 200;

async function fetchScopedRuleChecks(companyId: string, creativeIds: string[]) {
    const rows: Array<{
        creative_id: string;
        overall_status: string;
        overall_score: number;
        results: unknown;
        checked_at: string;
    }> = [];

    for (let i = 0; i < creativeIds.length; i += CREATIVE_CHECKS_CHUNK_SIZE) {
        const chunk = creativeIds.slice(i, i + CREATIVE_CHECKS_CHUNK_SIZE);
        const { data, error } = await supabase
            .from('creative_rule_checks')
            .select('creative_id, overall_status, overall_score, results, checked_at')
            .eq('company_id', companyId)
            .in('creative_id', chunk)
            .order('checked_at', { ascending: false });
        if (error) throw error;
        if (data) rows.push(...data);
    }

    return rows;
}

export function useComplianceSummary(
    integrationIds?: string[],
    campaignScope?: MonitoredCampaignScope | null,
    scopeLoading?: boolean,
) {
    const { user } = useAuth();
    const companyId = user?.company?.id ?? user?.company_id ?? undefined;

    return useQuery({
        queryKey: ['compliance-summary', companyId, integrationIdsKey(integrationIds), campaignScope?.monitoredIntegrationIds.length ?? 'unset'],
        queryFn: async (): Promise<ComplianceSummaryData> => {
            if (!companyId) throw new Error('No company ID');

            let integrationFilterIds: string[];
            if (campaignScope) {
                if (campaignScope.monitoredIntegrationIds.length === 0) {
                    return EMPTY_COMPLIANCE_SUMMARY;
                }
                integrationFilterIds = campaignScope.monitoredIntegrationIds;
            } else if (integrationIds && integrationIds.length > 0) {
                integrationFilterIds = integrationIds;
            } else {
                const { data: monitored, error } = await supabase
                    .from('integrations')
                    .select('id, is_monitored')
                    .eq('company_id', companyId);
                if (error) throw error;
                integrationFilterIds = (monitored ?? [])
                    .filter((i) => i.is_monitored === true)
                    .map((i) => i.id);
                if (integrationFilterIds.length === 0) return EMPTY_COMPLIANCE_SUMMARY;
            }

            const scopedCreatives = await fetchAllPaginated<{ id: string }>(() =>
                supabase
                    .from('creatives')
                    .select('id, campaigns!inner(integration_id)')
                    .eq('company_id', companyId)
                    .in('campaigns.integration_id', integrationFilterIds)
                    .ilike('status', 'active'),
            );
            const scopedCreativeIdList = scopedCreatives.map((c) => c.id);
            if (scopedCreativeIdList.length === 0) return EMPTY_COMPLIANCE_SUMMARY;

            const checks = await fetchScopedRuleChecks(companyId, scopedCreativeIdList);

            // Deduplicate: keep only latest check per creative
            const latestByCreative = new Map<string, typeof checks[number]>();
            for (const row of checks) {
                if (!latestByCreative.has(row.creative_id)) {
                    latestByCreative.set(row.creative_id, row);
                }
            }

            let approved = 0, warning = 0, rejected = 0;
            const ruleViolationCount = new Map<string, { count: number; severity: string }>();
            const nonCompliant: ComplianceSummaryData['non_compliant_creatives'] = [];

            for (const [creativeId, row] of latestByCreative) {
                if (row.overall_status === 'approved') approved++;
                else if (row.overall_status === 'warning') warning++;
                else if (row.overall_status === 'rejected') rejected++;

                const results = (row.results || []) as CreativeRuleCheckResult[];
                const failedRules = results
                    .filter((r: CreativeRuleCheckResult) => !r.passed)
                    .map((r: CreativeRuleCheckResult) => ({ rule_name: r.rule_name, severity: r.severity, reason: r.reason }));

                if (failedRules.length > 0) {
                    nonCompliant.push({
                        creative_id: creativeId,
                        creative_name: '', // will be enriched below
                        overall_status: row.overall_status,
                        overall_score: row.overall_score,
                        failed_rules: failedRules,
                    });

                    for (const fr of failedRules) {
                        const existing = ruleViolationCount.get(fr.rule_name);
                        if (existing) existing.count++;
                        else ruleViolationCount.set(fr.rule_name, { count: 1, severity: fr.severity });
                    }
                }
            }

            // Fetch creative names for non-compliant ones
            if (nonCompliant.length > 0) {
                const ids = nonCompliant.map(c => c.creative_id);
                const { data: creatives } = await supabase
                    .from('creatives')
                    .select('id, name')
                    .in('id', ids.slice(0, 50)); // limit to 50

                const nameMap = new Map((creatives || []).map(c => [c.id, c.name]));
                for (const nc of nonCompliant) {
                    nc.creative_name = nameMap.get(nc.creative_id) || 'Criativo sem nome';
                }
            }

            // Sort violated rules by count
            const topViolatedRules = Array.from(ruleViolationCount.entries())
                .map(([rule_name, { count, severity }]) => ({ rule_name, count, severity }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // Sort non-compliant by score ascending (worst first)
            nonCompliant.sort((a, b) => a.overall_score - b.overall_score);

            return {
                total_checked: latestByCreative.size,
                approved,
                warning,
                rejected,
                top_violated_rules: topViolatedRules,
                non_compliant_creatives: nonCompliant.slice(0, 5),
            };
        },
        enabled: !!companyId && !scopeLoading,
        staleTime: 5 * 60 * 1000,
        placeholderData: keepPreviousData,
    });
}

// Hook for batch fetching last check status for a list of creative IDs
export interface RuleCheckBatchItem {
    overall_status: string;
    overall_score: number;
    checked_at: string;
    ai_summary?: string;
    failed_rules: Array<{ rule_name: string; severity: string; reason: string }>;
}

export function useCreativeRuleChecksBatch(creativeIds: string[]) {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['creative-rule-checks-batch', companyId, creativeIds],
        queryFn: async () => {
            if (!creativeIds.length || !companyId) return {};
            const { data } = await supabase
                .from('creative_rule_checks')
                .select('creative_id, overall_status, overall_score, checked_at, results, ai_summary')
                .eq('company_id', companyId)
                .in('creative_id', creativeIds)
                .order('checked_at', { ascending: false });

            // Return a map: creative_id -> latest check with failed rules
            const map: Record<string, RuleCheckBatchItem> = {};
            for (const row of (data || [])) {
                if (!map[row.creative_id]) {
                    const results = (row.results || []) as CreativeRuleCheckResult[];
                    const failedRules = results
                        .filter((r: CreativeRuleCheckResult) => !r.passed)
                        .map((r: CreativeRuleCheckResult) => ({ rule_name: r.rule_name, severity: r.severity, reason: r.reason }));
                    map[row.creative_id] = {
                        overall_status: row.overall_status,
                        overall_score: row.overall_score,
                        checked_at: row.checked_at,
                        ai_summary: row.ai_summary,
                        failed_rules: failedRules,
                    };
                }
            }
            return map;
        },
        enabled: creativeIds.length > 0 && !!companyId,
    });
}
