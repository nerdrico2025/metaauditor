import { useAudits, Audit, type BatchAuditJob } from '@/hooks/useAudits';
import { friendlyEdgeFunctionError } from '@/lib/edgeFunctionErrors';
import { usePolicies } from '@/hooks/usePolicies';
import { useCreativeRuleCheck, useCreativeRules } from '@/hooks/useCreativeRules';
import { useCampaignAction } from '@/hooks/useCampaignAction';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Sparkles,
    Zap,
    Loader2,
    Shield,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    PauseCircle,
    Wallet,
    Target,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { RecomendacoesView } from '@/components/recomendacoes/RecomendacoesView';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';
import { SyncLikeOverlay } from '@/components/common/SyncLikeOverlay';
import { AUDIT_STEPS, mapFractionToStepIndex } from '@/components/common/syncLikeOverlayPresets';
import { useModule } from '@/contexts/ModuleContext';
import { dedupeLatestAudits, dedupeLatestEntityAudits, moduleToAuditFocus, primaryAuditScore } from '@/lib/audit-focus';
import { useEntityAuditsHistory } from '@/hooks/useEntityAudit';
import { PerformanceEntityAuditDialog } from '@/components/audits/PerformanceEntityAuditDialog';
import {
    AuditHistoryList,
    getHistoryEntryKind,
    getHistoryEntryName,
    type HistoryEntryKind,
} from '@/components/audits/AuditHistoryList';
import { CreativeAuditReportDialog } from '@/components/audits/CreativeAuditReportDialog';
import { PerformanceHistoryFilters } from '@/components/audits/PerformanceHistoryFilters';
import { SelectRuleDialog } from '@/components/branding/SelectRuleDialog';
import {
    countByAuditStatus,
    matchesSearchFilter,
    matchesStatusFilter,
    resolvePolicyIdForBatch,
    type HistoryStatusFilter,
} from '@/lib/auditHistoryFilters';

type HistoryScope = 'all' | 'creative' | 'campaign' | 'ad_set';

interface HistoryEntry {
    audit: Audit;
    kind: HistoryEntryKind;
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

function sortHistoryEntries(
    entries: HistoryEntry[],
    auditFocus: ReturnType<typeof moduleToAuditFocus>,
): HistoryEntry[] {
    return [...entries].sort((a, b) => {
        if (a.kind === 'creative' && b.kind === 'creative') {
            const spendA = a.audit.creatives?.spend ?? 0;
            const spendB = b.audit.creatives?.spend ?? 0;
            if (spendB !== spendA) return spendB - spendA;
        }
        const scoreA = primaryAuditScore(a.audit, auditFocus);
        const scoreB = primaryAuditScore(b.audit, auditFocus);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.audit.created_at).getTime() - new Date(a.audit.created_at).getTime();
    });
}

const BATCH_STEP_LABELS = AUDIT_STEPS.map((s) => s.label);

function mapBatchProgressToStepIndex(processed: number, total: number): number {
    if (total <= 0) return 0;
    return mapFractionToStepIndex(processed / total, AUDIT_STEPS.length);
}

export default function Diagnosticos() {
    const location = useLocation();
    const isRecomendacoes = location.pathname.startsWith('/recomendacoes');
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);
    const { module } = useModule();
    const auditFocus = moduleToAuditFocus(module);
    const isPerformance = module === 'performance';
    const isBranding = module === 'branding';
    const { audits, isLoading, runBatchAudit, invalidateAudits } = useAudits(auditFocus);
    const { data: entityAudits = [], isLoading: isLoadingEntityAudits } = useEntityAuditsHistory();
    const { policies } = usePolicies();
    const { rules: creativeRules, toggleRule } = useCreativeRules();
    const navigate = useNavigate();
    const campaignAction = useCampaignAction();

    const [selectedCreativeAudit, setSelectedCreativeAudit] = useState<Audit | null>(null);
    const [reportDialogOpen, setReportDialogOpen] = useState(false);
    const [historyScope, setHistoryScope] = useState<HistoryScope>('all');
    const [historyCampaignId, setHistoryCampaignId] = useState<string | 'all'>('all');
    const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>('all');
    const [historySearch, setHistorySearch] = useState('');
    const [selectedEntityAudit, setSelectedEntityAudit] = useState<Audit | null>(null);
    const [entityDialogOpen, setEntityDialogOpen] = useState(false);
    const [showRulesPanel, setShowRulesPanel] = useState(false);
    const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
    const [newBudgetValue, setNewBudgetValue] = useState('');

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
    const [isBatchRuleDialogOpen, setIsBatchRuleDialogOpen] = useState(false);

    const { lastCheck: ruleCheck } = useCreativeRuleCheck(
        isBranding && reportDialogOpen && selectedCreativeAudit?.creative_id
            ? selectedCreativeAudit.creative_id
            : null,
    );

    useEffect(() => {
        setSelectedCreativeAudit(null);
        setReportDialogOpen(false);
        setSelectedEntityAudit(null);
        setEntityDialogOpen(false);
        setHistoryScope('all');
        setHistoryCampaignId('all');
        setHistoryStatusFilter('all');
        setHistorySearch('');
    }, [auditFocus]);

    useEffect(() => {
        setHistoryCampaignId('all');
    }, [historyScope]);

    const sortedAudits = useMemo(() => {
        if (!audits.length) return [];

        const unique = dedupeLatestAudits(audits, auditFocus);

        return unique.sort((a, b) => {
            if (isPerformance) {
                const spendA = a.creatives?.spend ?? 0;
                const spendB = b.creatives?.spend ?? 0;
                if (spendB !== spendA) return spendB - spendA;
            } else {
                const scoreA = primaryAuditScore(a, auditFocus);
                const scoreB = primaryAuditScore(b, auditFocus);
                if (scoreB !== scoreA) return scoreB - scoreA;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [audits, auditFocus, isPerformance]);

    const sortedEntityAudits = useMemo(() => {
        if (!isPerformance || !entityAudits.length) return [];
        const unique = dedupeLatestEntityAudits(entityAudits);
        return unique.sort((a, b) => {
            const scoreA = primaryAuditScore(a, 'performance');
            const scoreB = primaryAuditScore(b, 'performance');
            if (scoreB !== scoreA) return scoreB - scoreA;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [entityAudits, isPerformance]);

    const historyCampaignOptions = useMemo(() => {
        if (!isPerformance) return [];

        const byId = new Map<string, string>();

        for (const audit of sortedAudits) {
            const id = auditCampaignId(audit);
            const name = audit.creatives?.campaigns?.name ?? audit.campaigns?.name;
            if (id && name) byId.set(id, name);
        }

        for (const audit of sortedEntityAudits) {
            if (audit.audit_level !== 'campaign') continue;
            const id = auditCampaignId(audit);
            const name = audit.campaigns?.name;
            if (id && name) byId.set(id, name);
        }

        return Array.from(byId.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [isPerformance, sortedAudits, sortedEntityAudits]);

    const defaultPolicyId = useMemo(
        () => policies.find((p) => p.is_default)?.id ?? null,
        [policies],
    );

    const scopeHistoryEntries = useMemo((): HistoryEntry[] => {
        const creativeEntries: HistoryEntry[] = sortedAudits.map((audit) => ({
            audit,
            kind: 'creative' as const,
        }));
        if (!isPerformance) return creativeEntries;

        const entityEntries: HistoryEntry[] = sortedEntityAudits.map((audit) => ({
            audit,
            kind: getHistoryEntryKind(audit),
        }));

        let merged: HistoryEntry[];

        if (historyScope === 'creative') {
            merged = creativeEntries;
        } else if (historyScope === 'campaign') {
            const campaignEntities = entityEntries.filter((e) => e.kind === 'campaign');
            merged = [...campaignEntities, ...creativeEntries];
            if (historyCampaignId !== 'all') {
                merged = merged.filter((e) => auditCampaignId(e.audit) === historyCampaignId);
            }
        } else if (historyScope === 'ad_set') {
            const adSetEntities = entityEntries.filter((e) => e.kind === 'ad_set');
            const adSetCreatives = creativeEntries.filter((e) => !!e.audit.creatives?.ad_set_id);
            merged = [...adSetEntities, ...adSetCreatives];
        } else {
            merged = [...creativeEntries, ...entityEntries];
        }

        return sortHistoryEntries(merged, auditFocus);
    }, [
        sortedAudits,
        sortedEntityAudits,
        isPerformance,
        historyScope,
        historyCampaignId,
        auditFocus,
    ]);

    const entriesBeforeStatusFilter = useMemo((): HistoryEntry[] => {
        let entries = scopeHistoryEntries;

        if (isPerformance && historySearch.trim()) {
            entries = entries.filter((entry) =>
                matchesSearchFilter(getHistoryEntryName(entry.audit), historySearch),
            );
        }

        return entries;
    }, [
        scopeHistoryEntries,
        isPerformance,
        historySearch,
    ]);

    const statusCounts = useMemo(
        () => countByAuditStatus(entriesBeforeStatusFilter),
        [entriesBeforeStatusFilter],
    );

    const historyEntries = useMemo((): HistoryEntry[] => {
        if (!isPerformance || historyStatusFilter === 'all') return entriesBeforeStatusFilter;
        return entriesBeforeStatusFilter.filter((entry) =>
            matchesStatusFilter(entry.audit, historyStatusFilter),
        );
    }, [entriesBeforeStatusFilter, isPerformance, historyStatusFilter]);

    const hasAnyHistory = sortedAudits.length > 0 || (isPerformance && sortedEntityAudits.length > 0);
    const hasActiveHistoryFilters =
        historyScope !== 'all'
        || historyStatusFilter !== 'all'
        || historySearch.trim().length > 0
        || (historyScope === 'campaign' && historyCampaignId !== 'all');
    const hasFilteredEmptyHistory =
        hasAnyHistory && historyEntries.length === 0 && hasActiveHistoryFilters;
    const pageLoading = isLoading || (isPerformance && isLoadingEntityAudits);

    const selectedListId = reportDialogOpen
        ? selectedCreativeAudit?.id
        : entityDialogOpen
            ? selectedEntityAudit?.id
            : null;

    const handleSelectHistoryEntry = (entry: HistoryEntry) => {
        if (entry.kind === 'creative') {
            setSelectedEntityAudit(null);
            setEntityDialogOpen(false);
            setSelectedCreativeAudit(entry.audit);
            setReportDialogOpen(true);
        } else {
            setSelectedCreativeAudit(null);
            setReportDialogOpen(false);
            setSelectedEntityAudit(entry.audit);
            setEntityDialogOpen(true);
        }
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
        const SKIP_RECENT_HOURS = 24;

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
                ...(isBranding && ruleIds.length > 0 ? { creativeRuleIds: ruleIds } : {}),
                ...(!isBranding && ruleIds.length > 0 ? { performanceRuleIds: ruleIds } : {}),
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

    const batchOverlay = (
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
    );

    const dialogCreative = selectedCreativeAudit?.creatives ?? null;
    const dialogCampaigns = dialogCreative?.campaigns;
    const entityDialogLevel = selectedEntityAudit?.audit_level === 'ad_set' ? 'ad_set' as const : 'campaign' as const;

    const neuralEmptyState = (
        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center relative overflow-hidden">
                <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                <div className="absolute inset-0 bg-primary/5 animate-ping rounded-full" />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-foreground">Sistema Neural Aguardando Dados</h2>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
                    Nenhum diagnóstico de IA foi encontrado para {isBranding ? 'branding' : 'performance'}.
                    {isPerformance
                        ? ' Analise criativos, campanhas ou conjuntos para ver o histórico aqui.'
                        : ' Analise criativos ativos em campanhas monitoradas para obter insights de conformidade e branding.'}
                </p>
            </div>
        </div>
    );

    if (isRecomendacoes) {
        return (
            <motion.div
                initial="hidden"
                animate="visible"
                variants={container}
                className="p-6 pb-24 space-y-10 max-w-[1400px] mx-auto"
            >
                <motion.div variants={item}>
                    <SectionHeader
                        title="Recomendações Click Auditor"
                        description="Análise estratégica a nível de conta e campanha, alimentada pela experiência da equipe Click Auditor."
                        size="large"
                    />
                </motion.div>
                <motion.div variants={item}>
                    <RecomendacoesView />
                </motion.div>
            </motion.div>
        );
    }

    if (pageLoading) {
        return (
            <div className="p-8 space-y-8 max-w-[1200px] mx-auto">
                <Skeleton className="h-12 w-1/3 rounded-xl" />
                <div className="space-y-3">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                </div>
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
                    title={isPerformance ? 'Histórico de Análises' : 'Centro de Diagnóstico Neural'}
                    description={
                        isPerformance
                            ? 'Análises de performance por anúncio, campanha e conjunto. Clique em uma entrada para ver o relatório.'
                            : 'Histórico de diagnósticos de branding. Clique em um criativo para ver o relatório completo.'
                    }
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

            {isPerformance && (
                <motion.div variants={item}>
                    <PerformanceHistoryFilters
                        search={historySearch}
                        onSearchChange={setHistorySearch}
                        historyScope={historyScope}
                        onHistoryScopeChange={setHistoryScope}
                        historyStatusFilter={historyStatusFilter}
                        onHistoryStatusFilterChange={setHistoryStatusFilter}
                        historyCampaignId={historyCampaignId}
                        onHistoryCampaignIdChange={setHistoryCampaignId}
                        historyCampaignOptions={historyCampaignOptions}
                        statusCounts={statusCounts}
                    />
                </motion.div>
            )}

            {isBranding && hasAnyHistory && (
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
                    selectedId={selectedListId}
                    showEntityBadges={isPerformance}
                    showSpend={isPerformance}
                    auditFocus={auditFocus}
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
                                            ? `Nenhuma análise com status "${historyStatusFilter === 'approved' ? 'Aprovado' : historyStatusFilter === 'rejected' ? 'Reprovado' : 'Pendente'}" neste escopo.`
                                            : historyScope === 'campaign' && historyCampaignId !== 'all'
                                                    ? 'Não há diagnósticos para esta campanha. Rode análise de IA na página Campanhas ou analise criativos ativos.'
                                                    : historyScope === 'campaign'
                                                        ? 'Inclui diagnósticos de campanha (página Campanhas) e anúncios vinculados. Rode uma análise para popular o histórico.'
                                                        : historyScope === 'ad_set'
                                                            ? 'Inclui diagnósticos de conjunto e anúncios do conjunto. Rode análise em Conjuntos ou analise criativos ativos.'
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
                footerActions={
                    isPerformance && dialogCampaigns ? (
                        <div className="flex flex-wrap gap-2">
                            {dialogCampaigns.status !== 'PAUSED' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (!dialogCampaigns?.id) return;
                                        campaignAction.mutate({
                                            campaign_id: dialogCampaigns.id,
                                            action: 'pause',
                                        });
                                    }}
                                    disabled={campaignAction.isPending}
                                    className="border-amber-500/30 text-amber-600"
                                >
                                    {campaignAction.isPending && campaignAction.variables?.action === 'pause' ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <PauseCircle className="w-4 h-4 mr-2" />
                                    )}
                                    Pausar campanha
                                </Button>
                            )}
                            <Button
                                size="sm"
                                onClick={() => {
                                    const currentBudget = dialogCampaigns?.daily_budget || 0;
                                    setNewBudgetValue(String(currentBudget));
                                    setBudgetDialogOpen(true);
                                }}
                                disabled={campaignAction.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <Wallet className="w-4 h-4 mr-2" />
                                Aumentar verba
                            </Button>
                        </div>
                    ) : undefined
                }
            />

            {isPerformance && selectedEntityAudit && (
                <PerformanceEntityAuditDialog
                    open={entityDialogOpen}
                    onOpenChange={(open) => {
                        setEntityDialogOpen(open);
                        if (!open) setSelectedEntityAudit(null);
                    }}
                    audit={selectedEntityAudit}
                    entityName={
                        selectedEntityAudit.audit_level === 'ad_set'
                            ? selectedEntityAudit.ad_sets?.name ?? 'Conjunto'
                            : selectedEntityAudit.campaigns?.name ?? 'Campanha'
                    }
                    entityLevel={entityDialogLevel}
                />
            )}

            {budgetDialogOpen && dialogCampaigns && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
                    onClick={() => setBudgetDialogOpen(false)}
                    onKeyDown={(e) => e.key === 'Escape' && setBudgetDialogOpen(false)}
                    role="presentation"
                >
                    <div
                        className="bg-card border border-border rounded-2xl shadow-sm w-full max-w-md p-6 space-y-4 mx-4"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-labelledby="budget-dialog-title"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10">
                                <Wallet className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <h3 id="budget-dialog-title" className="text-lg font-bold text-foreground">
                                    Aumentar Verba Diária
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Campanha: {dialogCampaigns.name}
                                </p>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Verba atual:{' '}
                                <span className="font-semibold text-foreground">
                                    {formatCurrency(dialogCampaigns.daily_budget || 0)}
                                </span>
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="budget-input" className="text-sm font-medium">
                                Nova verba diária (R$)
                            </label>
                            <input
                                id="budget-input"
                                type="number"
                                step="0.01"
                                min="1"
                                value={newBudgetValue}
                                onChange={(e) => setNewBudgetValue(e.target.value)}
                                className="w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-ch-orange"
                                placeholder="0.00"
                            />
                        </div>
                        <div className="flex gap-2">
                            {[1.25, 1.5, 2].map((multiplier) => {
                                const currentBudget = dialogCampaigns.daily_budget || 0;
                                const newVal = (currentBudget * multiplier).toFixed(2);
                                const pct = Math.round((multiplier - 1) * 100);
                                return (
                                    <Button
                                        key={multiplier}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setNewBudgetValue(newVal)}
                                        className="flex-1 rounded-xl text-xs font-semibold"
                                    >
                                        +{pct}%
                                    </Button>
                                );
                            })}
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={() => setBudgetDialogOpen(false)} className="rounded-xl">
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => {
                                    if (!dialogCampaigns?.id || !newBudgetValue) return;
                                    const budgetInCents = Math.round(parseFloat(newBudgetValue) * 100);
                                    campaignAction.mutate(
                                        {
                                            campaign_id: dialogCampaigns.id,
                                            action: 'update_budget',
                                            payload: { daily_budget: budgetInCents },
                                        },
                                        { onSuccess: () => setBudgetDialogOpen(false) },
                                    );
                                }}
                                disabled={
                                    campaignAction.isPending ||
                                    !newBudgetValue ||
                                    parseFloat(newBudgetValue) <= 0
                                }
                                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                            >
                                {campaignAction.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Wallet className="w-4 h-4" />
                                )}
                                Confirmar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {batchOverlay}

            <SelectRuleDialog
                isOpen={isBatchRuleDialogOpen}
                onClose={() => setIsBatchRuleDialogOpen(false)}
                onConfirm={(ids) => {
                    setIsBatchRuleDialogOpen(false);
                    void handleBatchAnalysis(ids);
                }}
                variant={isBranding ? 'branding' : 'performance'}
                title="Quais regras aplicar na análise em lote?"
                description="Selecione as regras antes de iniciar a varredura de criativos ativos."
            />
        </motion.div>
    );
}
