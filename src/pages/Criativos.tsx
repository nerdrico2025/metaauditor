import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { useCreatives } from '@/hooks/useCreatives';
import { useCreativeImageCache } from '@/hooks/useCreativeImageCache';
import { supabase } from '@/integrations/supabase/client';
import { filterCreativesForBatchAudit } from '@/lib/batchAuditSkip';
import { BATCH_SKIP_RECENT_HOURS } from '@/config/auditConstants';
import { parseSupabaseFunctionError, friendlyEdgeFunctionError } from '@/lib/edgeFunctionErrors';
import { getProxiedImageUrl, formatCurrency, formatNumber, cn } from '@/lib/utils';
import { CreativeCompliancePreview } from '@/components/branding/CreativeCompliancePreview';
import { CreativeMediaPreview } from '@/components/branding/CreativeMediaPreview';
import { InfoTip } from '@/components/ui/info-tip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Image as ImageIcon,
    Search,
    Filter,
    Grid3X3,
    List,
    Loader2,
    Play,
    FileImage,
    Film,
    Eye,
    TrendingUp,
    DollarSign,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    LayoutGrid,
    Sparkles,
    BrainCircuit,
    Activity,
    ShieldCheck,
    RefreshCw,
    AlertTriangle,
    History,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AiDiagnosisModal } from '@/components/ai/AiDiagnosisModal';
import CreativeRuleCheckModal from '@/components/integrations/CreativeRuleCheckModal';
import { SelectRuleDialog } from '@/components/branding/SelectRuleDialog';
import { AuditHistorySheet } from '@/components/audits/AuditHistorySheet';
import { useCreativeRuleChecksBatch } from '@/hooks/useCreativeRules';
import {
    brandingCheckStatusLabel,
    resolveBrandingCheckStatus,
} from '@/lib/brandingRuleCheckStatus';
import { useModule } from '@/contexts/ModuleContext';
import { useBrandingCompliance } from '@/hooks/useBrandingCompliance';
import { countByComplianceStatus, creativeIdsForComplianceStatus } from '@/lib/brandingComplianceFilter';
import { usePerformanceCompliance } from '@/hooks/usePerformanceCompliance';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';
import { useTranslation } from 'react-i18next';
import { useCampaign } from '@/hooks/useCampaigns';
import { conjuntosPath, criativosPath } from '@/lib/campaignNavigation';
import { isActiveCampaignStatus } from '@/lib/creativeScope';
import { CreativeGridCard, getTypeConfig } from '@/components/creatives/CreativeGridCard';
import { CrossFocusStatusBadge } from '@/components/creatives/CrossFocusStatusBadge';
import { useCrossFocusStatusMap } from '@/hooks/useCrossFocusStatusMap';
import { useBrandingGateBatchFlow } from '@/hooks/useBrandingGateBatchFlow';
import {
    BRANDING_GATE_BLOCK_MSG,
    isBrandingApprovedForPerformance,
} from '@/lib/brandingPerformanceGate';
import { creativeGalleryGrid, statsGridCols } from '@/lib/responsiveGrids';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { SyncLikeOverlay } from '@/components/common/SyncLikeOverlay';
import {
    AUDIT_STEPS,
    mapFractionToStepIndex,
    mapProgressRange,
} from '@/components/common/syncLikeOverlayPresets';

const PAGE_SIZE = 12;
/** Chamadas paralelas a audit-creative (evita timeout da edge audit-batch ao encadear muitas auditorias). */
const BATCH_AUDIT_CONCURRENCY = 2;
const BATCH_STEP_LABELS = AUDIT_STEPS.map((s) => s.label);

function mapBatchProgressToStepIndex(processed: number, total: number): number {
    return mapFractionToStepIndex(total > 0 ? processed / total : 0, AUDIT_STEPS.length);
}

export default function Criativos() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const campaignId = searchParams.get('campaignId') || undefined;
    const adSetId = searchParams.get('adSetId') || undefined;
    const complianceFromUrl = searchParams.get('compliance');
    const initialComplianceFilter: 'all' | 'approved' | 'rejected' | 'pending' =
        complianceFromUrl === 'approved' || complianceFromUrl === 'rejected' || complianceFromUrl === 'pending'
            ? complianceFromUrl
            : 'all';
    const { t } = useTranslation('campaigns');
    const queryClient = useQueryClient();
    const { user } = useAuth();
    // D2: manual sync is admin-only.
    const isAdmin = user?.role === 'company_admin' || user?.role === 'super_admin';
    const { effectiveIds } = useIntegrationFilter();
    const { range: dateRange } = useDateFilter();
    const { module } = useModule();
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);
    const cardMotion = reduced
        ? { initial: false as const, animate: { opacity: 1, y: 0 } }
        : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } };
    const isBranding = module === 'branding';
    const { runWithBrandingGate, BrandingGateDialog, isResolvingBrandingGate } = useBrandingGateBatchFlow();
    const { data: brandingCompliance } = useBrandingCompliance();
    const { data: performanceCompliance } = usePerformanceCompliance();
    const complianceByCreative = isBranding
        ? brandingCompliance?.byCreative
        : performanceCompliance?.byCreative;
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>(isBranding ? 'created_at' : 'spend');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [activeOnly, setActiveOnly] = useState(true);
    const [page, setPage] = useState(0);
    // B2/C1: branding compliance filter.
    // Default 'all' em ambos os modos — 'approved' como default escondia anúncios ainda
    // não auditados, deixando a tela vazia antes da primeira auditoria (briefing #9 revisado).
    const [complianceFilter, setComplianceFilter] = useState<'all' | 'approved' | 'rejected' | 'pending'>(initialComplianceFilter);

    useEffect(() => {
        const param = searchParams.get('compliance');
        if (param === 'approved' || param === 'rejected' || param === 'pending') {
            setComplianceFilter(param);
            setPage(0);
        } else if (!param) {
            setComplianceFilter('all');
        }
    }, [searchParams]);

    // AI Diagnosis State
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [selectedCreativeId, setSelectedCreativeId] = useState<string | null>(null);
    const [aiData, setAiData] = useState<any>(null);

    // Rule Check State
    const [ruleCheckModal, setRuleCheckModal] = useState<{ id: string; name: string } | null>(null);
    // B5: open SelectRuleDialog first; user picks rules; then we open CreativeRuleCheckModal with ruleIds.
    const [pendingRuleCheck, setPendingRuleCheck] = useState<{ id: string; name: string } | null>(null);
    const [ruleCheckRuleIds, setRuleCheckRuleIds] = useState<string[]>([]);
    const openRuleCheck = (id: string, name: string) => setPendingRuleCheck({ id, name });

    // History Sheet State (creativeId = null => histórico global)
    const [historySheet, setHistorySheet] = useState<{ creativeId?: string } | null>(null);

    // Sync State
    const [isSyncing, setIsSyncing] = useState(false);
    const [isBatchAiRunning, setIsBatchAiRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState(0);
    const [batchStepIndex, setBatchStepIndex] = useState(0);
    const [batchStep, setBatchStep] = useState('');
    const [batchFinished, setBatchFinished] = useState(false);
    const [batchProcessed, setBatchProcessed] = useState(0);
    const [batchCandidates, setBatchCandidates] = useState(0);
    const [batchAudited, setBatchAudited] = useState(0);
    const [batchFailed, setBatchFailed] = useState(0);
    const [batchSkippedRecent, setBatchSkippedRecent] = useState(0);
    const [batchSkippedInactiveCampaign, setBatchSkippedInactiveCampaign] = useState(0);

    type PendingAnalysisAction =
        | { type: 'batch'; mode: 'page' | 'top50' }
        | { type: 'diagnosis'; id: string }
        | null;
    const [pendingAnalysisAction, setPendingAnalysisAction] = useState<PendingAnalysisAction>(null);

    const { data: filterAdSet } = useQuery({
        queryKey: ['ad_set', adSetId],
        queryFn: async () => {
            if (!adSetId || !user?.company_id) return null;
            const { data, error } = await supabase
                .from('ad_sets')
                .select('id, name, campaign_id')
                .eq('id', adSetId)
                .eq('company_id', user.company_id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!adSetId && !!user?.company_id,
    });

    const resolvedCampaignId = campaignId ?? filterAdSet?.campaign_id;
    const { data: filterCampaign } = useCampaign(resolvedCampaignId ?? '');

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sem sessão ativa');

            // Buscar apenas integrações monitoradas da empresa
            const { data: integrations, error: intError } = await supabase
                .from('integrations')
                .select('id')
                .eq('company_id', user?.company_id)
                .eq('is_monitored', true);

            if (intError) throw intError;
            if (!integrations || integrations.length === 0) {
                const { toast } = await import('sonner');
                toast.error('Nenhuma integração ativa encontrada');
                return;
            }

            const integrationIds = integrations.map(i => i.id);

            // Fase 1: entidades
            const { data, error: functionError } = await supabase.functions.invoke('sync-meta-data', {
                body: { integration_id: integrationIds, sync_type: 'full' },
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (functionError) throw functionError;

            let totalItems = data.results?.reduce((acc: number, r: any) => acc + (r.items_synced || 0), 0) || 0;

            // Fase 2: métricas — invocação separada com orçamento próprio de ~150s
            const idsForMetrics = (data.results || [])
                .filter((r: any) => r.status !== 'error' && r.status !== 'skipped_special_account')
                .map((r: any) => r.integration_id);
            if (idsForMetrics.length > 0) {
                const { data: mData } = await supabase.functions.invoke('sync-meta-data', {
                    body: { integration_id: idsForMetrics, sync_type: 'metrics_only' },
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                totalItems += mData?.results?.reduce((acc: number, r: any) => acc + (r.items_synced || 0), 0) || 0;
            }

            const { toast } = await import('sonner');
            toast.success(`Sincronização concluída — ${totalItems} itens atualizados`);

            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error: any) {
            console.error(error);
            const { toast } = await import('sonner');
            toast.error(error.message || 'Erro ao sincronizar dados');
        } finally {
            setIsSyncing(false);
        }
    };

    const PAUSED_CAMPAIGN_MSG = 'Campanha pausada — análise disponível apenas para campanhas ativas';

    const executeDiagnosis = async (id: string, ruleIds: string[]) => {
        setSelectedCreativeId(id);
        setIsAiModalOpen(true);
        setIsAiLoading(true);
        setAiData(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sem sessão ativa');

            const body: Record<string, unknown> = {
                creative_id: id,
                audit_focus: module,
            };
            if (isBranding && ruleIds.length > 0) {
                body.rule_ids = ruleIds;
            } else if (!isBranding && ruleIds.length > 0) {
                body.performance_rule_ids = ruleIds;
            }

            const { data, error: functionError } = await supabase.functions.invoke('audit-creative', {
                body,
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (functionError || !data?.success) {
                const detail = await parseSupabaseFunctionError(functionError, data);
                throw new Error(friendlyEdgeFunctionError(detail, 'Erro ao executar diagnóstico IA.'));
            }

            if (data.audit_id) {
                const { data: auditRecord } = await supabase
                    .from('audits')
                    .select('*')
                    .eq('id', data.audit_id)
                    .single();
                if (auditRecord) setAiData(auditRecord);
                else setAiData(data);
            } else {
                setAiData(data);
            }

        } catch (error) {
            console.error(error);
            const { toast } = await import('sonner');
            const msg = error instanceof Error ? error.message : String(error);
            toast.error(friendlyEdgeFunctionError(msg, 'Erro ao executar diagnóstico IA.'));
            setIsAiModalOpen(false);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleRunDiagnosis = async (
        e: React.MouseEvent,
        id: string,
        campaignStatus?: string | null,
    ) => {
        e.stopPropagation();

        let resolvedStatus = campaignStatus;
        if (resolvedStatus === undefined) {
            if (!user?.company_id) return;
            const { data: row } = await supabase
                .from('creatives')
                .select('campaigns(status)')
                .eq('id', id)
                .eq('company_id', user.company_id)
                .maybeSingle();
            resolvedStatus = (row?.campaigns as { status?: string } | null)?.status ?? null;
        }

        if (!isActiveCampaignStatus(resolvedStatus)) {
            const { toast } = await import('sonner');
            toast.warning(PAUSED_CAMPAIGN_MSG);
            return;
        }

        if (!isBranding && !isBrandingApprovedForPerformance(getCrossFocusStatus(id))) {
            const { toast } = await import('sonner');
            toast.error(BRANDING_GATE_BLOCK_MSG);
            return;
        }

        setPendingAnalysisAction({ type: 'diagnosis', id });
    };

    const restrictToCreativeIds = useMemo(() => {
        if (complianceFilter === 'all' || !complianceByCreative) return undefined;
        return creativeIdsForComplianceStatus(complianceByCreative, complianceFilter);
    }, [complianceFilter, complianceByCreative]);

    const { data, isLoading, refetch } = useCreatives({
        search: search || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        status: activeOnly ? 'active' : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sortBy: sortBy as any,
        sortOrder: 'desc',
        integrationIds: effectiveIds,
        dateFrom: dateRange.isAll ? undefined : dateRange.startDate,
        dateTo: dateRange.isAll ? undefined : dateRange.endDate,
        campaignId,
        adSetId,
        restrictToCreativeIds,
    });

    useEffect(() => {
        if (!adSetId || isLoading || !data) return;
        if (data.total === 1 && data.creatives[0]?.id) {
            navigate(`/criativos/${data.creatives[0].id}`, {
                replace: true,
                state: { returnTo: criativosPath({ campaignId, adSetId }) },
            });
        }
    }, [adSetId, isLoading, data, campaignId, navigate]);

    const creatives = useMemo(() => data?.creatives ?? [], [data?.creatives]);
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const creativeIds = creatives.map(c => c.id);
    const { data: ruleChecksMap } = useCreativeRuleChecksBatch(creativeIds);
    const { oppositeFocus, getStatus: getCrossFocusStatus } = useCrossFocusStatusMap(creativeIds, module);

    const fetchTopActiveCreativeIds = async (): Promise<string[]> => {
        const companyId = user?.company_id;
        if (!companyId) return [];

        let monitoredIds = [...(effectiveIds || [])];
        if (monitoredIds.length === 0) {
            const { data: ints } = await supabase
                .from('integrations')
                .select('id')
                .eq('company_id', companyId)
                .eq('is_monitored', true);
            monitoredIds = (ints || []).map((i) => i.id);
        }
        if (monitoredIds.length === 0) return [];

        const { data: camps } = await supabase
            .from('campaigns')
            .select('id')
            .eq('company_id', companyId)
            .in('integration_id', monitoredIds)
            .or('status.eq.active,status.eq.ACTIVE');
        const campaignIds = (camps || []).map((c) => c.id);
        if (campaignIds.length === 0) return [];

        const { data: rows, error } = await supabase
            .from('creatives')
            .select('id')
            .eq('company_id', companyId)
            .in('campaign_id', campaignIds)
            .ilike('status', 'active')
            .order('spend', { ascending: false, nullsFirst: false })
            .limit(50);

        if (error) throw new Error(error.message);
        return (rows || []).map((r) => r.id);
    };

    const resetBatchOverlay = () => {
        setBatchFinished(false);
        setBatchProgress(0);
        setBatchStep('');
        setBatchStepIndex(0);
        setBatchProcessed(0);
        setBatchCandidates(0);
        setBatchAudited(0);
        setBatchFailed(0);
        setBatchSkippedRecent(0);
        setBatchSkippedInactiveCampaign(0);
    };

    const initBatchOverlay = (initialStep?: string) => {
        resetBatchOverlay();
        setIsBatchAiRunning(true);
        setBatchStepIndex(0);
        setBatchStep(initialStep ?? BATCH_STEP_LABELS[0]);
    };

    const runBootstrapAnimation = async () => {
        const start = Date.now();
        while (Date.now() - start < 1500) {
            const elapsed = Date.now() - start;
            setBatchProgress(Math.round((elapsed / 1500) * 10));
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    };

    const applyBatchProgress = (done: number, total: number, ok: number, fail: number) => {
        setBatchProcessed(done);
        setBatchCandidates(total);
        setBatchAudited(ok);
        setBatchFailed(fail);
        setBatchProgress(mapProgressRange(done, total));
        const stepIdx = mapBatchProgressToStepIndex(done, total);
        setBatchStepIndex(stepIdx);
        setBatchStep(BATCH_STEP_LABELS[stepIdx]);
    };

    const animateBatchFinished = async (currentProgress: number) => {
        setBatchStepIndex(BATCH_STEP_LABELS.length - 1);
        setBatchStep('Concluído!');
        for (let p = Math.max(currentProgress, 90); p <= 100; p += 2) {
            setBatchProgress(p);
            await new Promise((resolve) => setTimeout(resolve, 80));
        }
        setBatchProgress(100);
        setBatchFinished(true);
        await new Promise((resolve) => setTimeout(resolve, 800));
    };

    const showEmptyBatchOverlay = async (detail: string) => {
        setBatchProgress(100);
        setBatchStepIndex(BATCH_STEP_LABELS.length - 1);
        setBatchStep(detail);
        setBatchFinished(true);
        await new Promise((resolve) => setTimeout(resolve, 800));
    };

    const runAuditCreativeClientBatch = async (
        ids: string[],
        auditFocus: 'performance' | 'branding' = module,
        ruleIds: string[] = [],
        onProgress?: (p: { done: number; total: number; ok: number; fail: number; failPaused: number }) => void,
    ): Promise<{ ok: number; fail: number; failPaused: number; failOther: number }> => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sem sessão ativa');
        const headers = { Authorization: `Bearer ${session.access_token}` };
        let ok = 0;
        let fail = 0;
        let failPaused = 0;
        let failOther = 0;
        const total = ids.length;
        let done = 0;

        for (let i = 0; i < ids.length; i += BATCH_AUDIT_CONCURRENCY) {
            const slice = ids.slice(i, i + BATCH_AUDIT_CONCURRENCY);
            const outcomes = await Promise.all(
                slice.map(async (creative_id) => {
                    const body: Record<string, unknown> = { creative_id, audit_focus: auditFocus };
                    if (auditFocus === 'branding' && ruleIds.length > 0) {
                        body.rule_ids = ruleIds;
                    } else if (auditFocus === 'performance' && ruleIds.length > 0) {
                        body.performance_rule_ids = ruleIds;
                    }
                    const { data, error } = await supabase.functions.invoke('audit-creative', {
                        body,
                        headers,
                    });
                    if (!error && data?.success !== false) {
                        return { ok: true as const };
                    }
                    const detail = await parseSupabaseFunctionError(error, data);
                    const isPaused = /Campanha pausada|sem campanha ativa/i.test(detail);
                    return { ok: false as const, isPaused };
                }),
            );
            for (const outcome of outcomes) {
                if (outcome.ok) {
                    ok++;
                } else {
                    fail++;
                    if (outcome.isPaused) failPaused++;
                    else failOther++;
                }
                done++;
                onProgress?.({ done, total, ok, fail, failPaused });
            }
        }
        return { ok, fail, failPaused, failOther };
    };

    const buildBatchSkipParams = (
        ids: string[],
        campaignStatusByCreativeId?: Map<string, string | null | undefined>,
    ) => ({
        companyId: user!.company_id!,
        creativeIds: ids,
        auditFocus: module,
        integrationIds: effectiveIds?.length ? effectiveIds : undefined,
        ...(campaignStatusByCreativeId ? { campaignStatusByCreativeId } : {}),
    });

    const formatBatchSkipSummary = (skippedRecent: number, skippedInactive: number) => {
        const parts: string[] = [];
        if (skippedRecent > 0) {
            parts.push(`${skippedRecent} pulado(s) (últimas ${BATCH_SKIP_RECENT_HOURS}h)`);
        }
        if (skippedInactive > 0) {
            parts.push(`${skippedInactive} pulado(s) (campanha pausada)`);
        }
        return parts.length ? `, ${parts.join(', ')}` : '';
    };

    const executeBatchAudit = async (
        resolveIds: () => Promise<string[]>,
        ruleIds: string[],
        preFetchStep?: string,
        campaignStatusByCreativeId?: Map<string, string | null | undefined>,
    ) => {
        initBatchOverlay(preFetchStep);
        const toastMod = await import('sonner');
        let currentProgress = 0;

        try {
            await runBootstrapAnimation();
            currentProgress = 10;
            setBatchProgress(10);

            const ids = await resolveIds();
            if (!ids.length) {
                await showEmptyBatchOverlay('Nenhum criativo encontrado');
                toastMod.toast.message('Nenhum criativo ativo encontrado para auditar.');
                return;
            }

            const { toAudit, skippedRecent, skippedInactiveCampaign } = await filterCreativesForBatchAudit(
                supabase,
                buildBatchSkipParams(ids, campaignStatusByCreativeId),
            );
            setBatchSkippedRecent(skippedRecent);
            setBatchSkippedInactiveCampaign(skippedInactiveCampaign);

            if (!toAudit.length) {
                const skipDetail = [
                    skippedInactiveCampaign > 0 ? `${skippedInactiveCampaign} campanha pausada` : null,
                    skippedRecent > 0 ? `${skippedRecent} auditados recentemente` : null,
                ]
                    .filter(Boolean)
                    .join(' · ');
                await showEmptyBatchOverlay(
                    skipDetail
                        ? `Nenhum criativo para auditar — ${skipDetail}`
                        : 'Nenhum criativo elegível para auditar',
                );
                toastMod.toast.message(
                    `Nenhum criativo para auditar${formatBatchSkipSummary(skippedRecent, skippedInactiveCampaign)}.`,
                );
                return;
            }

            setBatchCandidates(toAudit.length);
            const { ok, fail, failPaused, failOther } = await runAuditCreativeClientBatch(
                toAudit,
                module,
                ruleIds,
                (p) => {
                    currentProgress = mapProgressRange(p.done, p.total);
                    applyBatchProgress(p.done, p.total, p.ok, p.fail);
                },
            );

            await animateBatchFinished(currentProgress);
            const skipSummary = formatBatchSkipSummary(skippedRecent, skippedInactiveCampaign);
            let resultMsg = `Auditoria IA concluída: ${ok} auditados${skipSummary}`;
            if (fail > 0) {
                resultMsg += `, ${fail} falha(s)`;
                if (failPaused > 0 && failOther === 0) {
                    resultMsg += ' (campanha pausada)';
                } else if (failPaused > 0) {
                    resultMsg += ` (${failPaused} campanha pausada)`;
                }
            }
            toastMod.toast.success(resultMsg);
            await queryClient.invalidateQueries({ queryKey: ['creatives'] });
            await queryClient.invalidateQueries({ queryKey: ['creative-rule-checks-batch'] });
            refetch();
        } catch (err: unknown) {
            const raw = err instanceof Error ? err.message : String(err);
            toastMod.toast.error(friendlyEdgeFunctionError(raw, 'Erro na auditoria em lote'));
        } finally {
            setIsBatchAiRunning(false);
            resetBatchOverlay();
        }
    };

    const handleBatchAuditCurrentPage = async (ruleIds: string[], candidateIds?: string[]) => {
        const ids = candidateIds ?? creatives.map((c) => c.id);
        if (!ids.length) return;
        if (!user?.company_id) return;
        const campaignStatusByCreativeId = candidateIds
            ? undefined
            : new Map(creatives.map((c) => [c.id, c.campaigns?.status ?? null]));
        await executeBatchAudit(() => Promise.resolve(ids), ruleIds, undefined, campaignStatusByCreativeId);
    };

    const handleBatchAuditTopActive = async (ruleIds: string[], candidateIds?: string[]) => {
        if (!user?.company_id) return;
        await executeBatchAudit(
            () => (candidateIds ? Promise.resolve(candidateIds) : fetchTopActiveCreativeIds()),
            ruleIds,
            'Buscando criativos ativos por investimento…',
        );
    };

    const handleAnalysisRulesConfirm = (ruleIds: string[]) => {
        const action = pendingAnalysisAction;
        setPendingAnalysisAction(null);
        if (!action) return;
        if (action.type === 'batch') {
            if (isBranding) {
                if (action.mode === 'page') {
                    void handleBatchAuditCurrentPage(ruleIds);
                } else {
                    void handleBatchAuditTopActive(ruleIds);
                }
                return;
            }
            const runBatch = async (approvedIds: string[]) => {
                if (action.mode === 'page') {
                    await handleBatchAuditCurrentPage(ruleIds, approvedIds);
                } else {
                    await handleBatchAuditTopActive(ruleIds, approvedIds);
                }
            };
            void (async () => {
                const ids =
                    action.mode === 'page'
                        ? creatives.map((c) => c.id)
                        : await fetchTopActiveCreativeIds();
                const nameById = new Map(creatives.map((c) => [c.id, c.name ?? c.id]));
                await runWithBrandingGate(ids, runBatch, nameById);
            })();
        } else if (action.type === 'diagnosis') {
            if (!isBranding && !isBrandingApprovedForPerformance(getCrossFocusStatus(action.id))) {
                void import('sonner').then(({ toast }) => toast.error(BRANDING_GATE_BLOCK_MSG));
                return;
            }
            void executeDiagnosis(action.id, ruleIds);
        }
    };

    // Auto-cache Facebook images to Supabase Storage (up to 2 attempts per session)
    useCreativeImageCache(user?.company_id, creatives, refetch);

    const handleViewCreative = (creativeId: string) => {
        const returnTo = criativosPath({ campaignId, adSetId });
        navigate(`/criativos/${creativeId}`, { state: { returnTo } });
    };

    const filterSubtitle = adSetId
        ? t('breadcrumb.creativesInAdSet', { count: data?.total ?? 0 })
        : campaignId
            ? t('breadcrumb.creativesInCampaign', { count: data?.total ?? 0 })
            : 'Orquestração e análise de alto impacto para seus ativos criativos.';

    const campaignName = filterCampaign?.name;
    const adSetName = filterAdSet?.name;

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            className="p-4 md:p-6 space-y-6 md:space-y-10"
        >
            {/* Ultra Header */}
            <motion.div variants={item}>
                {(campaignId || adSetId) && (
                    <Breadcrumb className="mb-4">
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link to="/campanhas">{t('breadcrumb.campaigns')}</Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            {resolvedCampaignId && (
                                <>
                                    <BreadcrumbSeparator />
                                    <BreadcrumbItem>
                                        {adSetId ? (
                                            <BreadcrumbLink asChild>
                                                <Link to={conjuntosPath(resolvedCampaignId)}>
                                                    {campaignName ?? '...'}
                                                </Link>
                                            </BreadcrumbLink>
                                        ) : (
                                            <BreadcrumbPage>{campaignName ?? '...'}</BreadcrumbPage>
                                        )}
                                    </BreadcrumbItem>
                                </>
                            )}
                            {adSetId && (
                                <>
                                    <BreadcrumbSeparator />
                                    <BreadcrumbItem>
                                        <BreadcrumbLink asChild>
                                            <Link to={conjuntosPath(resolvedCampaignId)}>
                                                {t('breadcrumb.adSets')}
                                            </Link>
                                        </BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>{adSetName ?? '...'}</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </>
                            )}
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>{t('breadcrumb.creatives')}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                )}
                <SectionHeader
                    title="Repositório de Ativos Digitais"
                    description={filterSubtitle}
                    size="large"
                    actions={
                        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 xl:gap-3 w-full xl:w-auto">
                            <DateRangeFilter />
                            <DropdownMenu>
                        <InfoTip title="Diagnóstico IA em lote" hint="A IA audita vários criativos de uma vez — desta página ou os 50 ativos de maior investimento — e devolve uma análise profissional.">
                          <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isBatchAiRunning || isSyncing}
                                className="border-border bg-muted/30 hover:bg-ch-orange/10 hover:border-ch-orange/40 font-bold uppercase tracking-widest px-3 sm:px-4 h-10 rounded-2xl gap-2"
                            >
                                {isBatchAiRunning ? (
                                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                                ) : (
                                    <BrainCircuit className="w-4 h-4 shrink-0 text-ch-orange" />
                                )}
                                <span className="hidden sm:inline">IA em lote</span>
                                <span className="sm:hidden">IA</span>
                                <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                        </InfoTip>
                        <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] bg-popover border-border">
                            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Diagnóstico profissional IA
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={creatives.length === 0 || isBatchAiRunning}
                                className="cursor-pointer flex-col items-start gap-1 py-3"
                                onSelect={() => {
                                    setPendingAnalysisAction({ type: 'batch', mode: 'page' });
                                }}
                            >
                                <span className="font-bold text-foreground">Esta página ({creatives.length})</span>
                                <span className="text-xs text-muted-foreground font-normal leading-snug">
                                    Usa busca, filtros e período atuais. Até 12 criativos por execução.
                                </span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={isBatchAiRunning}
                                className="cursor-pointer flex-col items-start gap-1 py-3"
                                onSelect={() => {
                                    setPendingAnalysisAction({ type: 'batch', mode: 'top50' });
                                }}
                            >
                                <span className="font-bold text-foreground">Top 50 ativos (maior spend)</span>
                                <span className="text-xs text-muted-foreground font-normal leading-snug">
                                    Prioriza criativos ativos na empresa, independente da página.
                                </span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {/* D2: sync is admin-only and hidden in branding regardless */}
                    {!isBranding && isAdmin && (
                    <InfoTip title="Sincronizar (Admin)" hint="Puxa manualmente os dados mais recentes da Meta. Só admin vê isso — o sistema já sincroniza sozinho a cada 3 horas.">
                    <Button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="bg-foreground text-background hover:bg-ch-orange font-bold uppercase tracking-widest px-3 sm:px-4 h-10 rounded-2xl shadow-2xl group transition-all dark:bg-white dark:text-black dark:hover:bg-ch-orange"
                    >
                        {isSyncing ? (
                            <Loader2 className="w-4 h-4 sm:mr-2 animate-spin shrink-0" />
                        ) : (
                            <RefreshCw className="w-4 h-4 sm:mr-2 group-hover:rotate-180 transition-transform duration-700 shrink-0" />
                        )}
                        <span className="hidden xl:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar (Admin)'}</span>
                        <span className="xl:hidden">{isSyncing ? 'Sync...' : 'Sync'}</span>
                    </Button>
                    </InfoTip>
                    )}
                        </div>
                    }
                />
            </motion.div>

            {/* Quick Insights Grid — branding hides financial stats and shows compliance counts */}
            <div className={cn('grid gap-4 xl:gap-6', statsGridCols[isBranding ? 5 : 6])}>
                {(isBranding
                    ? (() => {
                        const counts = countByComplianceStatus(brandingCompliance?.byCreative ?? new Map());
                        return [
                            { label: 'Biblioteca', value: total, icon: LayoutGrid, color: 'text-ch-orange', bg: 'bg-ch-orange/10' },
                            { label: 'Vídeo / Motion', value: data?.typeCounts?.video || 0, icon: Film, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
                            { label: 'Estáticos', value: data?.typeCounts?.image || 0, icon: FileImage, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                            { label: 'Aprovados', value: counts.approved, icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                            { label: 'Reprovados', value: counts.rejected, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
                        ];
                    })()
                    : (() => {
                        const counts = countByComplianceStatus(performanceCompliance?.byCreative ?? new Map());
                        return [
                            { label: 'Biblioteca', value: total, icon: LayoutGrid, color: 'text-ch-orange', bg: 'bg-ch-orange/10' },
                            { label: 'Vídeo / Motion', value: data?.typeCounts?.video || 0, icon: Film, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
                            { label: 'Estáticos', value: data?.typeCounts?.image || 0, icon: FileImage, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                            { label: 'Dentro da regra', value: counts.approved, icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                            { label: 'Fora da regra', value: counts.rejected, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
                            { label: 'Investimento', value: formatCurrency(creatives.reduce((acc, c) => acc + (Number(c.spend) || 0), 0)), icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                        ];
                    })()
                ).map((stat) => (
                    <motion.div key={stat.label} variants={item} className="min-w-0 bg-card border border-border shadow-sm rounded-2xl p-3 sm:p-4 xl:p-6 group hover-lift transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 mb-3">
                            <div className={`p-2 ${stat.bg} rounded-xl shrink-0`}>
                                <stat.icon className={`w-4 h-4 xl:w-5 xl:h-5 ${stat.color}`} />
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-2 leading-snug" title={stat.label}>{stat.label}</span>
                        </div>
                        <p className="text-lg xl:text-2xl font-bold text-foreground tracking-tighter tabular-nums truncate group-hover:text-ch-orange transition-colors" title={String(stat.value)}>{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Active Only Toggle + History */}
            <motion.div variants={item} className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
                <Button
                    variant="outline"
                    onClick={() => setHistorySheet({})}
                    className="h-10 px-5 rounded-xl text-[10px] font-semibold uppercase tracking-widest border-border text-muted-foreground hover:text-foreground hover:border-ch-blue/50 transition-all"
                >
                    <History className="w-4 h-4 mr-2 text-ch-blue" />
                    Histórico IA
                </Button>
                <Button
                    variant={activeOnly ? 'default' : 'outline'}
                    onClick={() => { setActiveOnly(!activeOnly); setPage(0); }}
                    className={`h-10 px-5 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-all ${
                        activeOnly
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                            : 'border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/50'
                    }`}
                >
                    <Activity className={`w-4 h-4 mr-2 ${activeOnly ? 'text-white' : 'text-emerald-500'}`} />
                    {activeOnly ? 'Mostrando apenas ativos' : 'Mostrar todos os criativos'}
                </Button>
            </motion.div>

            {/* Controls Bar */}
            <motion.div variants={item} className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 xl:gap-4 bg-muted/20 border border-border p-3 md:p-4 rounded-[1.5rem] backdrop-blur-sm shadow-xl">
                <div className="relative flex-1 min-w-0 w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="LOCALIZAR CRIATIVO POR NOME..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(0);
                        }}
                        className="pl-14 bg-transparent border-none text-[10px] font-bold uppercase tracking-[.1em] focus-visible:ring-0 placeholder:opacity-20 h-12"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:justify-end min-w-0">
                    {/* B2/C1: status filter — branding mode = all/approved/rejected/pending; performance mode = approved/all/rejected (branding compliance filter from briefing #9) */}
                    <Select value={complianceFilter} onValueChange={(v: 'all' | 'approved' | 'rejected' | 'pending') => { setComplianceFilter(v); setPage(0); }}>
                        <InfoTip
                            title={isBranding ? 'Status de branding' : 'Status de performance'}
                            hint={isBranding
                                ? 'Filtra pelos resultados da auditoria de branding (regras de criativo).'
                                : 'Filtra criativos que violam regras de performance (métricas vs limiar).'}
                        >
                          <SelectTrigger className="w-full sm:w-[11rem] xl:w-auto xl:min-w-[10rem] bg-muted/40 border-border h-10 rounded-xl text-[10px] font-semibold uppercase tracking-widest">
                            <ShieldCheck className="w-4 h-4 mr-2 text-ch-orange shrink-0" />
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </InfoTip>
                        <SelectContent className="bg-popover border-border font-semibold uppercase text-[10px] tracking-widest">
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="approved" className="text-emerald-500">
                                {isBranding ? 'Aprovados (branding)' : 'Dentro da regra'}
                            </SelectItem>
                            <SelectItem value="rejected" className="text-red-500">
                                {isBranding ? 'Reprovados (branding)' : 'Fora da regra'}
                            </SelectItem>
                            <SelectItem value="pending" className="text-muted-foreground">
                                {isBranding ? 'Pendentes de auditoria' : 'Sem regra de anúncio'}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    {/* In performance mode default to approved-only on first mount: handled by state init below */}

                    {!isBranding && (
                    <Select
                        value={sortBy}
                        onValueChange={(v) => {
                            setSortBy(v);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="w-full sm:w-[11rem] xl:w-auto xl:min-w-[10rem] bg-muted/40 border-border h-10 rounded-xl text-[10px] font-semibold uppercase tracking-widest">
                            <TrendingUp className="w-4 h-4 mr-2 text-ch-orange shrink-0" />
                            <SelectValue placeholder="Ordenar Por" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border font-semibold uppercase text-[10px] tracking-widest">
                            <SelectItem value="created_at">Mais Recentes</SelectItem>
                            <SelectItem value="spend" className="text-emerald-500">Maior Investimento</SelectItem>
                            <SelectItem value="impressions" className="text-blue-500">Mais Impressões</SelectItem>
                            <SelectItem value="clicks" className="text-indigo-500">Mais Cliques</SelectItem>
                            <SelectItem value="ctr" className="text-purple-500">Melhor CTR</SelectItem>
                            <SelectItem value="conversions" className="text-rose-500">Mais Resultados</SelectItem>
                        </SelectContent>
                    </Select>
                    )}

                    <Select
                        value={typeFilter}
                        onValueChange={(v) => {
                            setTypeFilter(v);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="w-full sm:w-[11rem] xl:w-auto xl:min-w-[10rem] bg-muted/40 border-border h-10 rounded-xl text-[10px] font-semibold uppercase tracking-widest">
                            <Filter className="w-4 h-4 mr-2 text-ch-orange shrink-0" />
                            <SelectValue placeholder="Formato de Mídia" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border font-semibold uppercase text-[10px] tracking-widest">
                            <SelectItem value="all">Sincronizar Tudo</SelectItem>
                            <SelectItem value="image" className="text-blue-400">Estáticos</SelectItem>
                            <SelectItem value="video" className="text-indigo-400">Motion Art</SelectItem>
                            <SelectItem value="carousel" className="text-emerald-400">Multi-Asset</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex p-1 bg-muted/40 border border-border rounded-xl h-12 shadow-inner">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('grid')}
                            className={`h-full w-10 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-ch-orange text-black' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('list')}
                            className={`h-full w-10 rounded-lg transition-all ${viewMode === 'list' ? 'bg-ch-orange text-black' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <List className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </motion.div>

            {/* Dynamic Gallery */}
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="py-32 flex flex-col items-center justify-center gap-6"
                    >
                        <Loader2 className="w-16 h-16 animate-spin text-ch-orange" />
                        <p className="text-muted-foreground font-bold tracking-widest uppercase text-[10px]">Carregando ativos neurais...</p>
                    </motion.div>
                ) : creatives.length > 0 ? (
                    <motion.div
                        key={viewMode}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-10"
                    >
                        {viewMode === 'grid' ? (
                            <div className={creativeGalleryGrid}>
                                {creatives.map((creative) => {
                                    const perfViolations = performanceCompliance?.violationsByCreative.get(creative.id) ?? [];
                                    const ruleCheck = isBranding ? ruleChecksMap?.[creative.id] : undefined;
                                    const brandingDisplayStatus = isBranding
                                        ? resolveBrandingCheckStatus(
                                            ruleCheck?.overall_status,
                                            ruleCheck?.failed_rules ?? [],
                                        )
                                        : 'pending';
                                    const isRejected = isBranding
                                        ? brandingDisplayStatus === 'rejected'
                                        : perfViolations.length > 0;
                                    const isWarning = isBranding && brandingDisplayStatus === 'warning';
                                    const failedRules = isBranding
                                        ? (ruleCheck?.failed_rules || [])
                                        : perfViolations.map(v => ({
                                            rule_name: v.rule_name,
                                            reason: `${v.metric.toUpperCase()} fora do limite`,
                                        }));

                                    return (
                                        <motion.div
                                            key={creative.id}
                                            {...cardMotion}
                                            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                                            className="min-w-0"
                                        >
                                            <CreativeGridCard
                                                creative={creative}
                                                isBranding={isBranding}
                                                isRejected={isRejected}
                                                isWarning={!!isWarning}
                                                failedRules={failedRules.map(r => ({
                                                    rule_name: r.rule_name,
                                                    reason: r.reason,
                                                }))}
                                                ruleCheckStatus={brandingDisplayStatus}
                                                brandingStatus={
                                                    brandingDisplayStatus === 'approved'
                                                        ? 'approved'
                                                        : brandingDisplayStatus === 'pending'
                                                            ? null
                                                            : 'rejected'
                                                }
                                                onClick={() => handleViewCreative(creative.id)}
                                                onRuleCheck={(e) => { e.stopPropagation(); openRuleCheck(creative.id, creative.name); }}
                                                onDiagnosis={!isBranding ? (e) => handleRunDiagnosis(e, creative.id, creative.campaigns?.status) : undefined}
                                                onHistory={(e) => { e.stopPropagation(); setHistorySheet({ creativeId: creative.id }); }}
                                                crossFocusStatus={getCrossFocusStatus(creative.id)}
                                                crossFocusOpposite={oppositeFocus}
                                            />
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-card border border-border shadow-sm rounded-[2rem] overflow-hidden">
                                <div className="divide-y divide-border/50">
                                    {creatives.map((creative) => {
                                        const config = getTypeConfig(creative.type);
                                        const Icon = config.icon;
                                        const perfViolations = performanceCompliance?.violationsByCreative.get(creative.id) ?? [];
                                        const listRuleCheck = isBranding ? ruleChecksMap?.[creative.id] : undefined;
                                        const listBrandingStatus = isBranding
                                            ? resolveBrandingCheckStatus(
                                                listRuleCheck?.overall_status,
                                                listRuleCheck?.failed_rules ?? [],
                                            )
                                            : 'pending';
                                        const isRejectedList = isBranding
                                            ? listBrandingStatus === 'rejected'
                                            : perfViolations.length > 0;
                                        const listFailedRules = isBranding
                                            ? (listRuleCheck?.failed_rules || [])
                                            : perfViolations.map(v => ({
                                                rule_name: v.rule_name,
                                                reason: `${v.metric.toUpperCase()} fora do limite`,
                                            }));

                                        return (
                                            <div
                                                key={creative.id}
                                                onClick={() => handleViewCreative(creative.id)}
                                                className={`p-6 flex items-center gap-8 hover:bg-muted/50 transition-all group cursor-pointer ${
                                                    isRejectedList
                                                        ? 'bg-rose-500/5 border-l-4 border-l-rose-500'
                                                        : isBranding && listBrandingStatus === 'warning'
                                                            ? 'bg-amber-500/5 border-l-4 border-l-amber-500'
                                                            : ''
                                                }`}
                                            >
                                                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-muted border border-border group-hover:border-ch-orange/30 transition-all flex-shrink-0 shadow-lg relative">
                                                    {creative.image_url ? (
                                                        isBranding ? (
                                                            <CreativeCompliancePreview
                                                                imageUrl={creative.image_url}
                                                                externalId={creative.external_id}
                                                                name={creative.name}
                                                                status={listBrandingStatus}
                                                                failedRules={listFailedRules.map(r => ({
                                                                    rule_name: r.rule_name,
                                                                    reason: r.reason,
                                                                }))}
                                                                size="sm"
                                                                fit={creative.type === 'video' ? 'contain' : 'cover'}
                                                                mediaType={creative.type}
                                                                videoUrl={creative.video_url}
                                                                aspectClassName="h-full w-full"
                                                                className="h-full w-full rounded-none"
                                                            />
                                                        ) : (
                                                            <CreativeMediaPreview
                                                                imageUrl={creative.image_url}
                                                                externalId={creative.external_id}
                                                                name={creative.name}
                                                                mediaType={creative.type}
                                                                videoUrl={creative.video_url}
                                                                fit={creative.type === 'video' ? 'contain' : 'cover'}
                                                                fill
                                                                roundedClassName="rounded-none"
                                                            />
                                                        )
                                                    ) : null}
                                                    <div className={`w-full h-full flex-col items-center justify-center gap-1 px-1 ${creative.image_url ? 'hidden' : 'flex'}`}>
                                                        <Icon className="w-5 h-5 text-muted-foreground opacity-20" />
                                                        <span className="text-[7px] font-bold text-red-500 leading-tight text-center">Sem permissão</span>
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <Icon className={cn('w-3.5 h-3.5', config.iconClass)} />
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{config.label}</span>
                                                    </div>
                                                    <h4 className="text-base font-bold text-foreground group-hover:text-ch-orange transition-colors truncate">
                                                        {creative.name}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground font-medium mt-1 truncate uppercase tracking-tighter">
                                                        ID Meta: {creative.external_id || 'Ativo Offline'}
                                                    </p>
                                                </div>

                                                {isBranding ? (
                                                    <div className="hidden lg:flex items-center gap-3 px-8 border-x border-border/50">
                                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                                                            listBrandingStatus === 'approved'
                                                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                                : listBrandingStatus === 'rejected'
                                                                    ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                                    : listBrandingStatus === 'warning'
                                                                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                                        : 'bg-muted text-muted-foreground border border-border'
                                                        }`}>
                                                            {listBrandingStatus === 'approved' ? <ShieldCheck className="w-3.5 h-3.5" /> :
                                                             listBrandingStatus === 'rejected' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                                                             listBrandingStatus === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                                                             <ShieldCheck className="w-3.5 h-3.5 opacity-40" />}
                                                            {brandingCheckStatusLabel(listBrandingStatus)}
                                                        </div>
                                                        <CrossFocusStatusBadge
                                                            oppositeFocus={oppositeFocus}
                                                            status={getCrossFocusStatus(creative.id)}
                                                        />
                                                    </div>
                                                ) : (
                                                <div className="hidden lg:flex items-center gap-8 px-8 border-x border-border/50">
                                                    <CrossFocusStatusBadge
                                                        oppositeFocus={oppositeFocus}
                                                        status={getCrossFocusStatus(creative.id)}
                                                    />
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Gasto</p>
                                                        <p className="text-sm font-bold tabular-nums text-emerald-500">{formatCurrency(creative.spend || 0)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Impacto</p>
                                                        <p className="text-sm font-bold tabular-nums">{formatNumber(creative.impressions || 0)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Regras perf.</p>
                                                        <p className={`text-sm font-bold tabular-nums ${perfViolations.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                            {perfViolations.length > 0 ? `${perfViolations.length} violação(ões)` : 'OK'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">CTR</p>
                                                        <p className="text-sm font-bold text-emerald-400 tabular-nums">{(creative.ctr || 0).toFixed(2)}%</p>
                                                    </div>
                                                </div>
                                                )}

                                                <div className="flex items-center gap-4 justify-end">
                                                    <Button
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRunDiagnosis(e, creative.id, creative.campaigns?.status);
                                                        }}
                                                        className="rounded-xl h-9 w-9 flex-shrink-0 bg-muted border-border text-muted-foreground hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all"
                                                        title="Diagnóstico IA"
                                                    >
                                                        <BrainCircuit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        onClick={(e) => { e.stopPropagation(); setHistorySheet({ creativeId: creative.id }); }}
                                                        className="rounded-xl h-9 w-9 flex-shrink-0 bg-muted border-border text-muted-foreground hover:bg-ch-blue hover:text-white hover:border-ch-blue transition-all"
                                                        title="Histórico de Análises"
                                                    >
                                                        <History className="w-4 h-4" />
                                                    </Button>
                                                    {isBranding && (
                                                    <Button
                                                        size="icon"
                                                        onClick={(e) => { e.stopPropagation(); openRuleCheck(creative.id, creative.name); }}
                                                        className={`rounded-xl border h-9 w-9 flex-shrink-0 transition-all ${listBrandingStatus === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black' : listBrandingStatus === 'rejected' ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white' : listBrandingStatus === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black' : 'bg-muted border-border text-muted-foreground hover:bg-blue-500 hover:text-white hover:border-blue-500'}`}
                                                        title="Verificar regras de branding"
                                                    >
                                                        <ShieldCheck className="w-4 h-4" />
                                                    </Button>
                                                    )}
                                                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-ch-orange group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Pagination Navigation */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-10 border-t border-border/50">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    EXIBINDO {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, total)} / {total} ATIVOS
                                </p>
                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="h-12 bg-muted border-border rounded-xl px-6 text-[10px] font-semibold uppercase tracking-widest transition-all hover:text-ch-orange"
                                    >
                                        <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
                                    </Button>

                                    <div className="flex gap-1.5 h-1 items-center">
                                        {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                                            <div
                                                key={i}
                                                className={`h-1.5 rounded-full transition-all duration-300 ${page === i ? 'bg-ch-orange w-8' : 'bg-muted-foreground/20 w-3'}`}
                                            />
                                        ))}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="h-12 bg-muted border-border rounded-xl px-6 text-[10px] font-semibold uppercase tracking-widest transition-all hover:text-ch-orange"
                                    >
                                        Próximo <ChevronRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-40 text-center space-y-6"
                    >
                        <div className="w-24 h-24 bg-ch-orange/5 border border-ch-orange/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
                            <ImageIcon className="w-10 h-10 text-ch-orange/40" />
                        </div>
                        <h3 className="text-2xl font-semibold text-foreground uppercase tracking-tighter">Nenhum Ativo Digital</h3>
                        <p className="text-muted-foreground font-medium max-w-sm mx-auto">Sua biblioteca está vazia ou os filtros aplicados não retornaram resultados.</p>
                        <Button
                            onClick={() => {
                                setTypeFilter('all');
                                setSearch('');
                            }}
                            className="bg-ch-orange hover:bg-ch-orange-hover text-black font-semibold uppercase tracking-widest h-14 px-10 rounded-2xl shadow-xl transition-all"
                        >
                            Resetar Filtros
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI Diagnosis Modal Integration */}
            <AiDiagnosisModal
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                data={aiData}
                isLoading={isAiLoading}
                onReanalyze={() => {
                    if (selectedCreativeId) {
                        setPendingAnalysisAction({ type: 'diagnosis', id: selectedCreativeId });
                    }
                }}
                title="Diagnóstico IA Expresso"
            />

            {/* Rule selector before batch IA / express diagnosis (performance) or rule check flow (branding) */}
            <SelectRuleDialog
                isOpen={!!pendingAnalysisAction}
                onClose={() => setPendingAnalysisAction(null)}
                onConfirm={handleAnalysisRulesConfirm}
                variant={isBranding ? 'branding' : 'performance'}
                title={
                    pendingAnalysisAction?.type === 'batch'
                        ? pendingAnalysisAction.mode === 'page'
                            ? `Quais regras aplicar na auditoria desta página (${creatives.length})?`
                            : 'Quais regras aplicar na auditoria dos top 50 ativos?'
                        : pendingAnalysisAction?.type === 'diagnosis'
                            ? 'Quais regras aplicar neste diagnóstico IA?'
                            : undefined
                }
            />

            {/* B5: rule selector — runs before the check modal */}
            <SelectRuleDialog
                isOpen={!!pendingRuleCheck}
                onClose={() => setPendingRuleCheck(null)}
                onConfirm={(ids) => {
                    if (!pendingRuleCheck) return;
                    setRuleCheckRuleIds(ids);
                    setRuleCheckModal(pendingRuleCheck);
                    setPendingRuleCheck(null);
                }}
                title={pendingRuleCheck ? `Quais regras aplicar em "${pendingRuleCheck.name}"?` : undefined}
            />

            {/* Creative Rule Check Modal */}
            {ruleCheckModal && (
                <CreativeRuleCheckModal
                    isOpen={!!ruleCheckModal}
                    onClose={() => setRuleCheckModal(null)}
                    creativeId={ruleCheckModal.id}
                    creativeName={ruleCheckModal.name}
                    ruleIds={ruleCheckRuleIds}
                />
            )}

            {/* Audit History Sheet */}
            <AuditHistorySheet
                open={!!historySheet}
                onOpenChange={(open) => !open && setHistorySheet(null)}
                creativeId={historySheet?.creativeId}
            />

            <SyncLikeOverlay
                open={isBatchAiRunning}
                progress={batchProgress}
                title={batchFinished ? 'Auditoria concluída' : 'Varredura Multi-Agente em Progresso'}
                subtitle={
                    batchCandidates > 0
                        ? `Processando ${Math.min(batchProcessed, batchCandidates)} de ${batchCandidates} criativos`
                        : batchFinished
                            ? batchStep
                            : batchStep || 'Preparando fila de criativos'
                }
                steps={AUDIT_STEPS}
                currentStepIndex={batchStepIndex}
                currentStepDetail={batchStep}
                theme="audit"
                finished={batchFinished}
                finishedTitle="Auditoria concluída"
                footerText="A auditoria pode levar alguns minutos dependendo do volume de criativos"
                footerFinishedText="Análises registradas no histórico de auditoria IA"
                stats={{
                    processed: batchProcessed,
                    total: batchCandidates,
                    audited: batchAudited,
                    skipped: batchSkippedRecent + batchSkippedInactiveCampaign,
                    failed: batchFailed,
                }}
            />

            {BrandingGateDialog}
        </motion.div>
    );
}
