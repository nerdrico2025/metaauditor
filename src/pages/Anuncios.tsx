import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Sparkles,
    Zap,
    Loader2,
    Shield,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    Target,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import { useAnunciosCampaigns } from '@/hooks/useAnunciosCampaigns';
import { BATCH_SKIP_RECENT_HOURS } from '@/config/auditConstants';
import { useAudits, type Audit, type BatchAuditJob } from '@/hooks/useAudits';
import { usePolicies } from '@/hooks/usePolicies';
import { useCreativeRuleCheck, useCreativeRules } from '@/hooks/useCreativeRules';
import { friendlyEdgeFunctionError } from '@/lib/edgeFunctionErrors';
import { dedupeLatestAudits } from '@/lib/audit-focus';
import {
    countByAuditStatus,
    matchesSearchFilter,
    matchesStatusFilter,
    resolvePolicyIdForBatch,
    type HistoryStatusFilter,
} from '@/lib/auditHistoryFilters';
import { SyncLikeOverlay } from '@/components/common/SyncLikeOverlay';
import { AUDIT_STEPS, mapFractionToStepIndex } from '@/components/common/syncLikeOverlayPresets';
import {
    AuditHistoryList,
    getHistoryEntryName,
    type AuditHistoryListEntry,
} from '@/components/audits/AuditHistoryList';
import { BrandingHistoryFilters } from '@/components/audits/BrandingHistoryFilters';
import { CreativeAuditReportDialog } from '@/components/audits/CreativeAuditReportDialog';
import { SelectRuleDialog } from '@/components/branding/SelectRuleDialog';
import { SectionHeader } from '@/components/ui/section-header';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { useCrossFocusStatusMap } from '@/hooks/useCrossFocusStatusMap';
import type { AppModule } from '@/contexts/ModuleContext';

const auditFocus = 'branding' as const;
const brandingModule: AppModule = 'branding';
const BATCH_STEP_LABELS = AUDIT_STEPS.map((s) => s.label);

function mapBatchProgressToStepIndex(processed: number, total: number): number {
    if (total <= 0) return 0;
    return mapFractionToStepIndex(processed / total, AUDIT_STEPS.length);
}

function auditCampaignId(audit: Audit): string | null {
    return (
        audit.campaign_id
        ?? audit.campaigns?.id
        ?? audit.creatives?.campaign_id
        ?? audit.creatives?.campaigns?.id
        ?? null
    );
}

export default function Anuncios() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const { effectiveIds } = useIntegrationFilter();
    const companyId = user?.company?.id;
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);

    const statusFromUrl = searchParams.get('status');
    const initialStatus: HistoryStatusFilter =
        statusFromUrl === 'approved' || statusFromUrl === 'rejected' || statusFromUrl === 'pending'
            ? statusFromUrl
            : 'all';

    const { audits, isLoading, runBatchAudit, invalidateAudits } = useAudits(auditFocus);
    const { policies } = usePolicies();
    const { rules: creativeRules, toggleRule } = useCreativeRules();
    const { campaigns } = useAnunciosCampaigns(companyId, effectiveIds);

    const [selectedCreativeAudit, setSelectedCreativeAudit] = useState<Audit | null>(null);
    const [reportDialogOpen, setReportDialogOpen] = useState(false);
    const [showRulesPanel, setShowRulesPanel] = useState(false);
    const [isBatchRuleDialogOpen, setIsBatchRuleDialogOpen] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [historyCampaignId, setHistoryCampaignId] = useState<string>('all');
    const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>(initialStatus);

    const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
    const [batchStep, setBatchStep] = useState('');
    const [batchStepIndex, setBatchStepIndex] = useState(0);
    const [batchProgress, setBatchProgress] = useState(0);
    const [batchFinished, setBatchFinished] = useState(false);
    const [batchProcessed, setBatchProcessed] = useState(0);
    const [batchCandidates, setBatchCandidates] = useState(0);
    const [batchAudited, setBatchAudited] = useState(0);
    const [batchFailed, setBatchFailed] = useState(0);
    const [batchSkippedRecent, setBatchSkippedRecent] = useState(0);

    const { lastCheck: ruleCheck } = useCreativeRuleCheck(
        reportDialogOpen && selectedCreativeAudit?.creative_id
            ? selectedCreativeAudit.creative_id
            : null,
    );

    useEffect(() => {
        const param = searchParams.get('status');
        if (param === 'approved' || param === 'rejected' || param === 'pending') {
            setHistoryStatusFilter(param);
        } else if (!param) {
            setHistoryStatusFilter('all');
        }
    }, [searchParams]);

    const handleStatusFilterChange = (value: HistoryStatusFilter) => {
        setHistoryStatusFilter(value);
        if (value === 'all') {
            searchParams.delete('status');
        } else {
            searchParams.set('status', value);
        }
        setSearchParams(searchParams, { replace: true });
    };

    const defaultPolicyId = useMemo(
        () => policies.find((p) => p.is_default)?.id ?? null,
        [policies],
    );

    const sortedAudits = useMemo(() => {
        if (!audits.length) return [];
        const unique = dedupeLatestAudits(audits, auditFocus);
        return unique.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }, [audits]);

    const scopeHistoryEntries = useMemo((): AuditHistoryListEntry[] => {
        return sortedAudits.map((audit) => ({ audit, kind: 'creative' as const }));
    }, [sortedAudits]);

    const entriesBeforeStatusFilter = useMemo((): AuditHistoryListEntry[] => {
        let entries = scopeHistoryEntries;

        if (historySearch.trim()) {
            entries = entries.filter((entry) =>
                matchesSearchFilter(getHistoryEntryName(entry.audit), historySearch),
            );
        }

        if (historyCampaignId !== 'all') {
            entries = entries.filter((entry) => auditCampaignId(entry.audit) === historyCampaignId);
        }

        return entries;
    }, [scopeHistoryEntries, historySearch, historyCampaignId]);

    const statusCounts = useMemo(
        () => countByAuditStatus(entriesBeforeStatusFilter),
        [entriesBeforeStatusFilter],
    );

    const historyEntries = useMemo((): AuditHistoryListEntry[] => {
        if (historyStatusFilter === 'all') return entriesBeforeStatusFilter;
        return entriesBeforeStatusFilter.filter((entry) =>
            matchesStatusFilter(entry.audit, historyStatusFilter),
        );
    }, [entriesBeforeStatusFilter, historyStatusFilter]);

    const hasAnyHistory = sortedAudits.length > 0;
    const hasActiveHistoryFilters =
        historyStatusFilter !== 'all'
        || historySearch.trim().length > 0
        || historyCampaignId !== 'all';
    const hasFilteredEmptyHistory =
        hasAnyHistory && historyEntries.length === 0 && hasActiveHistoryFilters;

    const campaignOptions = useMemo(
        () => ((campaigns ?? []) as any[]).map((c: any) => ({ id: c.id, name: c.name })),
        [campaigns],
    );

    const crossFocusCreativeIds = useMemo(
        () =>
            historyEntries
                .map((entry) => entry.audit.creative_id)
                .filter((id): id is string => !!id),
        [historyEntries],
    );
    const { oppositeFocus: crossFocusOpposite, statusMap: crossFocusByCreativeId } =
        useCrossFocusStatusMap(crossFocusCreativeIds, brandingModule);

    const handleSelectHistoryEntry = (entry: AuditHistoryListEntry) => {
        setSelectedCreativeAudit(entry.audit);
        setReportDialogOpen(true);
    };

    const handleBatchAnalysis = async (ruleIds: string[]) => {
        setIsBatchAnalyzing(true);
        setBatchFinished(false);
        setBatchProgress(0);
        setBatchProcessed(0);
        setBatchCandidates(0);
        setBatchAudited(0);
        setBatchFailed(0);
        setBatchSkippedRecent(0);
        setBatchStepIndex(0);
        setBatchStep(BATCH_STEP_LABELS[0]);

        const CHUNK_SIZE = 8;
        const SKIP_RECENT_HOURS = BATCH_SKIP_RECENT_HOURS;

        let currentProgress = 0;
        let totalAudited = 0;
        let totalFailed = 0;
        let totalSkippedRecent = 0;

        const applyJobProgress = (job: BatchAuditJob) => {
            const total = job.total_candidates || 0;
            const processed = job.processed || 0;

            setBatchCandidates(total);
            setBatchProcessed(processed);
            setBatchAudited(job.audited || 0);
            setBatchFailed(job.failed || 0);
            setBatchSkippedRecent(job.skipped_recent || 0);

            const target = total > 0
                ? 10 + Math.round((processed / total) * 80)
                : Math.min(currentProgress + 1, 15);
            currentProgress = Math.max(currentProgress, Math.min(target, 90));
            setBatchProgress(currentProgress);

            const stepIdx = mapBatchProgressToStepIndex(processed, total);
            setBatchStepIndex(stepIdx);
            setBatchStep(BATCH_STEP_LABELS[stepIdx]);
        };

        try {
            const batchPolicyId = resolvePolicyIdForBatch('default', defaultPolicyId);

            const bootstrapStart = Date.now();
            while (Date.now() - bootstrapStart < 1500) {
                const elapsed = Date.now() - bootstrapStart;
                currentProgress = Math.round((elapsed / 1500) * 10);
                setBatchProgress(currentProgress);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            const started = await runBatchAudit.mutateAsync({
                action: 'start',
                policyId: batchPolicyId,
                chunkSize: CHUNK_SIZE,
                skipRecentHours: SKIP_RECENT_HOURS,
                analysisMode: 'balanced',
                auditFocus,
                ...(ruleIds.length > 0 ? { creativeRuleIds: ruleIds } : {}),
            }) as { job?: BatchAuditJob };

            const jobId = started?.job?.id;
            if (!jobId) throw new Error('Falha ao iniciar job de auditoria');

            if (started.job) {
                applyJobProgress(started.job);
                currentProgress = Math.max(currentProgress, 10);
                setBatchProgress(currentProgress);
            }

            let isCompleted = false;
            while (!isCompleted) {
                const result = await runBatchAudit.mutateAsync({
                    action: 'process',
                    jobId,
                }) as { job?: BatchAuditJob };

                const job = result.job;
                if (!job) throw new Error('Retorno inválido do job de auditoria');
                if (job.status === 'failed') throw new Error('Job de auditoria falhou');

                applyJobProgress(job);
                totalAudited = job.audited || 0;
                totalFailed = job.failed || 0;
                totalSkippedRecent = job.skipped_recent || 0;

                isCompleted = job.status === 'completed';
                if (!isCompleted) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                }
            }

            setBatchStepIndex(BATCH_STEP_LABELS.length - 1);
            setBatchStep('Concluído!');
            for (let p = Math.max(currentProgress, 90); p <= 100; p += 2) {
                setBatchProgress(p);
                await new Promise((resolve) => setTimeout(resolve, 80));
            }
            setBatchProgress(100);
            setBatchFinished(true);
            await new Promise((resolve) => setTimeout(resolve, 800));

            invalidateAudits();

            toast.success(
                `Análise concluída: ${totalAudited} auditados, ${totalSkippedRecent} pulados (últimas 24h), ${totalFailed} falhas.`,
            );
        } catch (err) {
            const raw = err instanceof Error ? err.message : String(err);
            toast.error(friendlyEdgeFunctionError(raw, 'Falha na análise em lote. Tente novamente em instantes.'));
        } finally {
            setIsBatchAnalyzing(false);
            setBatchFinished(false);
            setBatchProgress(0);
            setBatchStep('');
            setBatchStepIndex(0);
            setBatchProcessed(0);
            setBatchCandidates(0);
            setBatchAudited(0);
            setBatchFailed(0);
            setBatchSkippedRecent(0);
        }
    };

    const neuralEmptyState = (
        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center relative overflow-hidden">
                <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                <div className="absolute inset-0 bg-primary/5 animate-ping rounded-full" />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-foreground">Sistema Neural Aguardando Dados</h2>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
                    Nenhum diagnóstico de IA foi encontrado para branding.
                    Analise criativos ativos em campanhas monitoradas para obter insights de conformidade e branding.
                </p>
            </div>
        </div>
    );

    const dialogCreative = selectedCreativeAudit?.creatives ?? null;

    if (isLoading) {
        return (
            <div className="p-8 space-y-8 max-w-[1200px] mx-auto">
                <Skeleton className="h-12 w-1/3 rounded-xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
            </div>
        );
    }

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            className="p-6 pb-24 space-y-8 max-w-[1200px] mx-auto"
        >
            <motion.div variants={item}>
                <SectionHeader
                    title="Histórico de Análises"
                    description="Análises de branding e conformidade por anúncio. Clique em uma entrada para ver o relatório."
                    size="large"
                    actions={
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                onClick={() => setIsBatchRuleDialogOpen(true)}
                                disabled={isBatchAnalyzing}
                                className="bg-foreground text-background hover:bg-primary font-semibold rounded-xl h-12 px-6 transition-all shadow-sm dark:bg-white dark:text-black dark:hover:bg-primary"
                            >
                                {isBatchAnalyzing ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Zap className="w-4 h-4 mr-2" />
                                )}
                                Analisar Criativos Ativos
                            </Button>

                            <Badge className="h-12 px-4 rounded-xl bg-primary/10 text-primary border-0 text-sm font-semibold">
                                {historyEntries.length} análise{historyEntries.length !== 1 ? 's' : ''}
                            </Badge>
                        </div>
                    }
                />
            </motion.div>

            <motion.div variants={item}>
                <BrandingHistoryFilters
                    search={historySearch}
                    onSearchChange={setHistorySearch}
                    historyCampaignId={historyCampaignId}
                    onHistoryCampaignIdChange={setHistoryCampaignId}
                    campaignOptions={campaignOptions}
                    historyStatusFilter={historyStatusFilter}
                    onHistoryStatusFilterChange={handleStatusFilterChange}
                    statusCounts={statusCounts}
                />
            </motion.div>

            {hasAnyHistory && (
                <motion.div variants={item}>
                    <button
                        type="button"
                        onClick={() => setShowRulesPanel(!showRulesPanel)}
                        className="w-full flex items-center justify-between p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-ch-orange/10">
                                <Shield className="w-4 h-4 text-ch-orange" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-foreground">Regras de Criativo que a IA verifica</p>
                                <p className="text-xs text-muted-foreground">
                                    {creativeRules?.filter((r) => r.is_active).length || 0} regra
                                    {(creativeRules?.filter((r) => r.is_active).length || 0) !== 1 ? 's' : ''} ativa
                                    {(creativeRules?.filter((r) => r.is_active).length || 0) !== 1 ? 's' : ''}
                                    {!creativeRules?.length && ' — crie regras na página Regras'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {(creativeRules?.filter((r) => r.is_active).length || 0) > 0 && (
                                <div className="flex -space-x-1">
                                    {creativeRules?.filter((r) => r.is_active).slice(0, 3).map((r) => (
                                        <div
                                            key={r.id}
                                            className="w-6 h-6 rounded-full bg-ch-orange/10 border-2 border-card flex items-center justify-center"
                                        >
                                            <ShieldCheck className="w-3 h-3 text-ch-orange" />
                                        </div>
                                    ))}
                                    {(creativeRules?.filter((r) => r.is_active).length || 0) > 3 && (
                                        <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                                            <span className="text-[8px] font-semibold text-muted-foreground">
                                                +{(creativeRules?.filter((r) => r.is_active).length || 0) - 3}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {showRulesPanel ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                        </div>
                    </button>

                    {showRulesPanel && (
                        <div className="mt-2 p-4 rounded-2xl border border-border bg-card space-y-3">
                            {creativeRules && creativeRules.length > 0 ? (
                                <>
                                    <div className="grid gap-2">
                                        {creativeRules.map((rule) => (
                                            <div
                                                key={rule.id}
                                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                    rule.is_active
                                                        ? 'border-ch-orange/20 bg-ch-orange/5'
                                                        : 'border-border bg-muted/20 opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <Shield
                                                        className={`w-4 h-4 flex-shrink-0 ${
                                                            rule.is_active ? 'text-ch-orange' : 'text-muted-foreground'
                                                        }`}
                                                    />
                                                    <div className="min-w-0">
                                                        <p
                                                            className={`text-sm font-semibold truncate ${
                                                                rule.is_active ? 'text-foreground' : 'text-muted-foreground'
                                                            }`}
                                                        >
                                                            {rule.name}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] font-bold uppercase text-muted-foreground">
                                                                {rule.rule_type === 'content'
                                                                    ? 'Conteúdo'
                                                                    : rule.rule_type === 'visual'
                                                                        ? 'Visual'
                                                                        : rule.rule_type}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground">·</span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {rule.applies_to === 'all'
                                                                    ? 'Todos'
                                                                    : rule.applies_to === 'video'
                                                                        ? 'Vídeo'
                                                                        : rule.applies_to === 'image'
                                                                            ? 'Imagem'
                                                                            : 'Carrossel'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={rule.is_active}
                                                    onCheckedChange={() =>
                                                        toggleRule.mutate({ id: rule.id, is_active: rule.is_active })
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-border">
                                        <p className="text-[10px] text-muted-foreground">
                                            Regras ativas serão verificadas na próxima análise
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-ch-orange hover:text-ch-orange/80 h-7 px-3"
                                            onClick={() => navigate('/regras')}
                                        >
                                            Gerenciar Regras
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
                                    <Shield className="w-8 h-8 text-muted-foreground/30" />
                                    <div>
                                        <p className="text-sm font-bold text-muted-foreground">Nenhuma regra criada</p>
                                        <p className="text-xs text-muted-foreground">
                                            Crie regras de criativo para a IA verificar durante o diagnóstico.
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="bg-ch-orange text-black font-bold"
                                        onClick={() => navigate('/regras')}
                                    >
                                        Criar Regras
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            )}

            <motion.div variants={item}>
                <AuditHistoryList
                    entries={historyEntries}
                    selectedId={reportDialogOpen ? selectedCreativeAudit?.id : null}
                    showEntityBadges={false}
                    showSpend={false}
                    auditFocus={auditFocus}
                    crossFocusOpposite={crossFocusOpposite}
                    crossFocusByCreativeId={crossFocusByCreativeId}
                    onSelect={handleSelectHistoryEntry}
                    emptyState={
                        !hasAnyHistory
                            ? neuralEmptyState
                            : hasFilteredEmptyHistory ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                                        <Target className="w-7 h-7 text-muted-foreground opacity-40" />
                                    </div>
                                    <p className="text-sm font-bold text-foreground">
                                        Nenhuma análise neste filtro
                                    </p>
                                    <p className="text-xs text-muted-foreground max-w-md">
                                        {historySearch.trim()
                                            ? `Nenhuma análise encontrada para "${historySearch.trim()}".`
                                            : historyStatusFilter !== 'all'
                                                ? `Nenhuma análise com status "${historyStatusFilter === 'approved' ? 'Aprovado' : historyStatusFilter === 'rejected' ? 'Reprovado' : 'Pendente'}".`
                                                : historyCampaignId !== 'all'
                                                    ? 'Não há diagnósticos para esta campanha. Use Analisar Criativos Ativos para popular o histórico.'
                                                    : 'Não há análises de anúncios no histórico. Use Analisar Criativos Ativos para começar.'}
                                    </p>
                                </div>
                            ) : undefined
                    }
                />
            </motion.div>

            <CreativeAuditReportDialog
                open={reportDialogOpen && !!selectedCreativeAudit}
                onOpenChange={(open) => {
                    setReportDialogOpen(open);
                    if (!open) setSelectedCreativeAudit(null);
                }}
                audit={selectedCreativeAudit}
                creative={dialogCreative}
                creativeRules={creativeRules}
                lastRulesCheck={
                    ruleCheck
                        ? {
                              overall_score: ruleCheck.overall_score,
                              ai_summary: ruleCheck.ai_summary,
                              results: ruleCheck.results,
                          }
                        : null
                }
                lastPerfResults={selectedCreativeAudit?.ai_analysis?.performance_rules_compliance ?? null}
                auditFocus={auditFocus}
            />

            <SyncLikeOverlay
                open={isBatchAnalyzing}
                progress={batchProgress}
                title={batchFinished ? 'Análise concluída' : 'Varredura Multi-Agente em Progresso'}
                subtitle={
                    batchCandidates > 0
                        ? `Processando ${Math.min(batchProcessed, batchCandidates)} de ${batchCandidates} criativos ativos em campanhas ativas`
                        : 'Preparando fila de criativos em campanhas ativas'
                }
                steps={AUDIT_STEPS}
                currentStepIndex={batchStepIndex}
                currentStepDetail={batchStep}
                theme="audit"
                finished={batchFinished}
                finishedTitle="Análise concluída"
                footerText="A varredura pode levar alguns minutos dependendo do volume de criativos em campanhas ativas"
                footerFinishedText="Relatório multi-agente compilado com sucesso"
                stats={{
                    processed: batchProcessed,
                    total: batchCandidates,
                    audited: batchAudited,
                    skipped: batchSkippedRecent,
                    failed: batchFailed,
                }}
            />

            <SelectRuleDialog
                isOpen={isBatchRuleDialogOpen}
                onClose={() => setIsBatchRuleDialogOpen(false)}
                onConfirm={(ids) => {
                    setIsBatchRuleDialogOpen(false);
                    void handleBatchAnalysis(ids);
                }}
                variant="branding"
                title="Quais regras aplicar na análise em lote?"
                description="Selecione as regras antes de iniciar a varredura de criativos ativos."
            />
        </motion.div>
    );
}
