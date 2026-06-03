import { useAudits, Audit, type BatchAuditJob } from '@/hooks/useAudits';
import { friendlyEdgeFunctionError } from '@/lib/edgeFunctionErrors';
import { usePolicies } from '@/hooks/usePolicies';
import { useCreativeRuleCheck, useCreativeRules } from '@/hooks/useCreativeRules';
import { useCampaignAction } from '@/hooks/useCampaignAction';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getProxiedImageUrl, formatCurrency, formatNumber, cn } from '@/lib/utils';
import { statsGridCols } from '@/lib/responsiveGrids';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
    Sparkles,
    BrainCircuit,
    Target,
    Zap,
    CheckCircle2,
    CheckCircle,
    Search,
    SearchCheck,
    Fingerprint,
    ScanEye,
    History,
    Loader2,
    ShieldCheck,
    XCircle,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Eye,
    MousePointerClick,
    BarChart3,
    Shield,
    ChevronDown,
    ChevronUp,
    Activity,
    DollarSign,
    Award,
    Dna,
    PauseCircle,
    Wallet,
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { RecomendacoesView } from '@/components/recomendacoes/RecomendacoesView';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';
import { SyncLikeOverlay } from '@/components/common/SyncLikeOverlay';
import { AUDIT_STEPS, mapFractionToStepIndex } from '@/components/common/syncLikeOverlayPresets';
import {
    getScoreBarColor,
    getScoreBgColor,
    getScoreColor,
    getScoreLabel,
    getScalingBadge,
} from '@/lib/audit-scores';
import { useModule } from '@/contexts/ModuleContext';
import { dedupeLatestAudits, dedupeLatestEntityAudits, moduleToAuditFocus, primaryAuditScore } from '@/lib/audit-focus';
import { useEntityAuditsHistory } from '@/hooks/useEntityAudit';
import { PerformanceEntityAuditDialog } from '@/components/audits/PerformanceEntityAuditDialog';

type HistoryScope = 'all' | 'creative' | 'campaign' | 'ad_set';
type HistoryEntryKind = 'creative' | 'campaign' | 'ad_set';

interface HistoryEntry {
    audit: Audit;
    kind: HistoryEntryKind;
}

function getHistoryEntryKind(audit: Audit): HistoryEntryKind {
    if (audit.audit_level === 'campaign') return 'campaign';
    if (audit.audit_level === 'ad_set') return 'ad_set';
    return 'creative';
}

function getHistoryEntryName(audit: Audit): string {
    if (audit.audit_level === 'campaign') return audit.campaigns?.name ?? 'Campanha';
    if (audit.audit_level === 'ad_set') return audit.ad_sets?.name ?? 'Conjunto';
    return audit.creatives?.name ?? 'Sem nome';
}

function historyKindLabel(kind: HistoryEntryKind): string {
    if (kind === 'campaign') return 'Campanha';
    if (kind === 'ad_set') return 'Conjunto';
    return 'Anúncio';
}

const formatPercent = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00%';
    return `${value.toFixed(2)}%`;
};

const BATCH_STEP_LABELS = AUDIT_STEPS.map((s) => s.label);

function mapBatchProgressToStepIndex(processed: number, total: number): number {
    if (total <= 0) return 0;
    return mapFractionToStepIndex(processed / total, AUDIT_STEPS.length);
}

export default function Diagnosticos() {
    const location = useLocation();
    // C2 (briefing #12): same component serves /diagnosticos (legacy) and /recomendacoes (renamed).
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
    const { user } = useAuth();
    const companyId = user?.company?.id;
    const [activeAudit, setActiveAudit] = useState<Audit | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyScope, setHistoryScope] = useState<HistoryScope>('all');
    const [selectedEntityAudit, setSelectedEntityAudit] = useState<Audit | null>(null);
    const [entityDialogOpen, setEntityDialogOpen] = useState(false);
    const [selectedPolicyId, setSelectedPolicyId] = useState<string>('default');
    const [previewIframe, setPreviewIframe] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [showRulesPanel, setShowRulesPanel] = useState(false);

    const campaignAction = useCampaignAction();
    const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
    const [newBudgetValue, setNewBudgetValue] = useState('');

    // Batch analysis overlay state
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

    // Fetch performance rules (automation_rules)
    const { data: performanceRules } = useQuery({
        queryKey: ['performance-rules', companyId],
        queryFn: async () => {
            if (!companyId) return [];
            const { data, error } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('company_id', companyId)
                .eq('status', 'active')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!companyId && isPerformance,
    });

    // Fetch creative rules check for the active audit's creative (branding module)
    const { lastCheck: ruleCheck, isLoading: loadingRuleCheck } = useCreativeRuleCheck(
        isBranding ? (activeAudit?.creative_id || null) : null,
    );

    useEffect(() => {
        setActiveAudit(null);
        setSelectedEntityAudit(null);
        setEntityDialogOpen(false);
        setHistoryScope('all');
    }, [auditFocus]);

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

    const historyEntries = useMemo((): HistoryEntry[] => {
        const creativeEntries: HistoryEntry[] = sortedAudits.map((audit) => ({
            audit,
            kind: 'creative' as const,
        }));
        if (!isPerformance) return creativeEntries;

        const entityEntries: HistoryEntry[] = sortedEntityAudits.map((audit) => ({
            audit,
            kind: getHistoryEntryKind(audit),
        }));

        let merged = [...creativeEntries, ...entityEntries];
        if (historyScope === 'creative') merged = creativeEntries;
        else if (historyScope === 'campaign') merged = entityEntries.filter((e) => e.kind === 'campaign');
        else if (historyScope === 'ad_set') merged = entityEntries.filter((e) => e.kind === 'ad_set');

        return merged.sort((a, b) => {
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
    }, [sortedAudits, sortedEntityAudits, isPerformance, historyScope, auditFocus]);

    const hasAnyHistory = sortedAudits.length > 0 || (isPerformance && sortedEntityAudits.length > 0);
    const pageLoading = isLoading || (isPerformance && isLoadingEntityAudits);

    const handleSelectHistoryEntry = (entry: HistoryEntry) => {
        if (entry.kind === 'creative') {
            setSelectedEntityAudit(null);
            setEntityDialogOpen(false);
            setActiveAudit(entry.audit);
            setPreviewIframe(null);
        } else {
            setActiveAudit(null);
            setSelectedEntityAudit(entry.audit);
            setEntityDialogOpen(true);
        }
        setHistoryOpen(false);
    };

    const historySheetPanel = (
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetContent className="bg-card border-l border-border w-[400px] sm:w-[540px]">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <History className="w-6 h-6 text-primary" />
                        {isPerformance ? 'Análises de Performance' : 'Criativos Analisados'}
                    </SheetTitle>
                    <SheetDescription>
                        {isPerformance
                            ? 'Anúncios, campanhas e conjuntos já auditados. Ordenados por relevância e score.'
                            : 'Ordenados por score de branding. Apenas criativos ativos.'}
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-150px)] pr-4">
                    <div className="space-y-4">
                        {historyEntries.map(({ audit, kind }) => {
                            const auditScore = audit.ai_analysis?.overall_score ?? primaryAuditScore(audit, auditFocus);
                            const auditSpend = audit.creatives?.spend ?? 0;
                            const isSelected =
                                (kind === 'creative' && activeAudit?.id === audit.id) ||
                                (kind !== 'creative' && selectedEntityAudit?.id === audit.id);
                            return (
                                <div
                                    key={audit.id}
                                    onClick={() => handleSelectHistoryEntry({ audit, kind })}
                                    className={`p-4 rounded-2xl border cursor-pointer transition-all group ${isSelected
                                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                                        : 'bg-card border-border hover:bg-card hover:border-primary/20'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            {kind === 'creative' && audit.creatives?.image_url && (
                                                <img
                                                    src={getProxiedImageUrl(audit.creatives.image_url) || audit.creatives.image_url}
                                                    alt=""
                                                    className="w-10 h-10 object-cover rounded-lg bg-muted"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            )}
                                            {kind !== 'creative' && (
                                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <Target className="w-5 h-5 text-primary" />
                                                </div>
                                            )}
                                            <div>
                                                {isPerformance && (
                                                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider px-1.5 py-0 mb-0.5">
                                                        {historyKindLabel(kind)}
                                                    </Badge>
                                                )}
                                                <h4 className={`font-bold text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                                    {getHistoryEntryName(audit)}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(new Date(audit.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                                    </p>
                                                    {kind === 'creative' && isPerformance && auditSpend > 0 && (
                                                        <span className="text-xs text-muted-foreground">
                                                            R${auditSpend.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={`${getScoreBgColor(auditScore)} ${getScoreColor(auditScore)} border-0`}>
                                            {auditScore}/100
                                        </Badge>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );

    // Auto-evaluate performance rules for active audit's creative
    const perfViolations = useMemo(() => {
        if (!isPerformance || !performanceRules || performanceRules.length === 0 || !activeAudit?.creatives) {
            return { violations: [], violatedMetrics: new Set<string>() };
        }

        const c = activeAudit.creatives;
        const ctr = Number(c.ctr) || 0;
        const cpc = Number(c.cpc) || 0;
        const spendVal = Number(c.spend) || 0;
        const metricValues: Record<string, number> = {
            ctr, cpc, spend: spendVal,
            impressions: Number(c.impressions) || 0,
            clicks: Number(c.clicks) || 0,
            conversions: Number(c.conversions) || 0,
        };

        const violations: Array<{ rule_name: string; metric: string; current: number; operator: string; threshold: number; action_type: string }> = [];
        const violatedMetrics = new Set<string>();

        for (const rule of performanceRules) {
            const cond = rule.trigger_conditions;
            if (!cond?.metric) continue;
            const current = metricValues[cond.metric] ?? 0;
            const threshold = Number(cond.threshold);
            let triggered = false;
            if (cond.operator === 'lt' || cond.operator === 'less_than') triggered = current < threshold;
            else if (cond.operator === 'lte') triggered = current <= threshold;
            else if (cond.operator === 'gt' || cond.operator === 'greater_than') triggered = current > threshold;
            else if (cond.operator === 'gte') triggered = current >= threshold;
            else if (cond.operator === 'equal') triggered = current === threshold;

            if (triggered) {
                violations.push({ rule_name: rule.name, metric: cond.metric, current, operator: cond.operator, threshold, action_type: rule.action_type });
                violatedMetrics.add(cond.metric);
            }
        }

        return { violations, violatedMetrics };
    }, [performanceRules, activeAudit, isPerformance]);

    const metricLabelToKey: Record<string, string> = {
        'Gasto': 'spend', 'Impressões': 'impressions', 'Cliques': 'clicks',
        'CTR': 'ctr', 'CPC': 'cpc', 'Resultado': 'conversions',
    };

    // Initial load: prefer highest-spend creative; otherwise first entity audit
    useEffect(() => {
        if (activeAudit || selectedEntityAudit) return;
        if (sortedAudits.length > 0) {
            const firstAiAudit = sortedAudits.find((a) => a.ai_analysis);
            setActiveAudit(firstAiAudit || sortedAudits[0]);
            return;
        }
        if (isPerformance && sortedEntityAudits.length > 0) {
            setSelectedEntityAudit(sortedEntityAudits[0]);
            setEntityDialogOpen(true);
        }
    }, [sortedAudits, sortedEntityAudits, activeAudit, selectedEntityAudit, isPerformance]);

    // Auto-fetch preview iframe when active audit's creative has no image_url
    useEffect(() => {
        if (!activeAudit?.creative_id || activeAudit.creatives?.image_url || loadingPreview) return;
        setPreviewIframe(null);
        setLoadingPreview(true);
        (async () => {
            try {
                const { data, error } = await supabase.functions.invoke('meta-ad-preview', {
                    body: { creative_id: activeAudit.creative_id },
                });
                if (!error && data) {
                    setPreviewIframe(data.preview_iframe || null);
                }
            } catch (e) {
                console.error('Failed to fetch preview for diagnostics:', e);
            } finally {
                setLoadingPreview(false);
            }
        })();
    }, [activeAudit?.id, activeAudit?.creative_id, activeAudit?.creatives?.image_url]);

    // Batch analysis with real progress overlay (sync-like pattern)
    const handleBatchAnalysis = async () => {
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
            // Phase 1: bootstrap animation while starting job (0% → 10%)
            const bootstrapStart = Date.now();
            while (Date.now() - bootstrapStart < 1500) {
                const elapsed = Date.now() - bootstrapStart;
                currentProgress = Math.round((elapsed / 1500) * 10);
                setBatchProgress(currentProgress);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            const started = await runBatchAudit.mutateAsync({
                action: 'start',
                policyId: selectedPolicyId === 'default' ? undefined : selectedPolicyId,
                chunkSize: CHUNK_SIZE,
                skipRecentHours: SKIP_RECENT_HOURS,
                analysisMode: 'balanced',
                auditFocus,
            }) as { job?: BatchAuditJob };

            const jobId = started?.job?.id;
            if (!jobId) throw new Error('Falha ao iniciar job de auditoria');

            if (started.job) {
                applyJobProgress(started.job);
                currentProgress = Math.max(currentProgress, 10);
                setBatchProgress(currentProgress);
            }

            // Phase 2: real processing loop (10% → 90%)
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

            // Phase 3: completion animation (90% → 100%)
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
            <div className="p-8 space-y-8">
                <Skeleton className="h-12 w-1/3 rounded-xl" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Skeleton className="h-[500px] rounded-[2.5rem]" />
                    <Skeleton className="h-[500px] rounded-[2.5rem]" />
                </div>
            </div>
        );
    }

    if (!hasAnyHistory) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center relative overflow-hidden">
                    <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                    <div className="absolute inset-0 bg-primary/5 animate-ping rounded-full" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-foreground">Sistema Neural Aguardando Dados</h2>
                    <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                        Nenhum diagnóstico de IA foi encontrado para {isBranding ? 'branding' : 'performance'}.
                        {isPerformance
                            ? ' Analise criativos, campanhas ou conjuntos para ver o histórico aqui.'
                            : ' Analise criativos ativos em campanhas monitoradas para obter insights de conformidade e branding.'}
                    </p>
                </div>
                <Button
                    onClick={() => handleBatchAnalysis()}
                    disabled={isBatchAnalyzing}
                    className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                    {isBatchAnalyzing ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Zap className="mr-2 w-4 h-4" />}
                    Analisar Criativos Ativos
                </Button>
                {batchOverlay}
            </div>
        );
    }

    if (!activeAudit && isPerformance && selectedEntityAudit) {
        const entityLevel = selectedEntityAudit.audit_level === 'ad_set' ? 'ad_set' as const : 'campaign' as const;
        return (
            <>
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={container}
                    className="p-6 pb-24 space-y-10 max-w-[1600px] mx-auto"
                >
                    <motion.div variants={item}>
                        <SectionHeader
                            title="Histórico de Análises"
                            description="Análises de performance por anúncio, campanha e conjunto. Selecione outra entrada no histórico ou analise novos criativos."
                            size="large"
                            actions={
                                <Button
                                    variant="outline"
                                    className="h-12 px-6 rounded-xl"
                                    onClick={() => setHistoryOpen(true)}
                                >
                                    <History className="w-4 h-4 mr-2 text-primary" />
                                    Histórico de Análises
                                    <Badge className="ml-2 bg-primary/10 text-primary border-0">
                                        {historyEntries.length}
                                    </Badge>
                                </Button>
                            }
                        />
                    </motion.div>
                </motion.div>
                <PerformanceEntityAuditDialog
                    open={entityDialogOpen}
                    onOpenChange={setEntityDialogOpen}
                    audit={selectedEntityAudit}
                    entityName={getHistoryEntryName(selectedEntityAudit)}
                    entityLevel={entityLevel}
                />
                {historySheetPanel}
            </>
        );
    }

    if (!activeAudit) {
        return (
            <div className="p-8 space-y-8">
                <Skeleton className="h-12 w-1/3 rounded-xl" />
                <Skeleton className="h-[500px] rounded-[2.5rem]" />
            </div>
        );
    }

    // Extract AI scores (use real AI data, no mocks)
    const ai = activeAudit.ai_analysis;
    const overallScore = ai?.overall_score ?? primaryAuditScore(activeAudit, auditFocus);
    const hookScore = ai?.hook_score ?? 0;
    const valueScore = ai?.value_proposition_score ?? 0;
    const persuasionScore = ai?.persuasion_score ?? 0;
    const visualScore = ai?.visual_score ?? 0;
    const ctaScore = ai?.cta_score ?? 0;
    const socialProofScore = ai?.social_proof_score ?? 0;
    const urgencyScore = ai?.urgency_score ?? 0;
    const targetScore = ai?.target_alignment_score ?? 0;

    const scalingBadge = getScalingBadge(ai?.scaling_recommendation);

    const entityDialogLevel = selectedEntityAudit?.audit_level === 'ad_set' ? 'ad_set' as const : 'campaign' as const;

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            className="p-6 pb-24 space-y-10 max-w-[1600px] mx-auto"
        >
            {/* Header Section */}
            <motion.div variants={item}>
                <SectionHeader
                    title={isPerformance ? 'Histórico de Análises' : 'Centro de Diagnóstico Neural'}
                    description={
                        isPerformance
                            ? 'Análises de performance por anúncio, campanha e conjunto. Filtre o histórico e abra o detalhe de cada diagnóstico.'
                            : 'Análise profunda de persuasão, design, psicologia do consumidor e compliance de regras.'
                    }
                    size="large"
                    actions={
                        <div className="flex flex-wrap items-center gap-3">
                            {isPerformance && (
                                <Select value={historyScope} onValueChange={(v) => setHistoryScope(v as HistoryScope)}>
                                    <SelectTrigger className="w-44 bg-card border-border h-11 rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary">
                                        <SelectValue placeholder="Escopo" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        <SelectItem value="all" className="text-xs font-medium">Todos</SelectItem>
                                        <SelectItem value="creative" className="text-xs font-medium">Anúncios</SelectItem>
                                        <SelectItem value="campaign" className="text-xs font-medium">Campanhas</SelectItem>
                                        <SelectItem value="ad_set" className="text-xs font-medium">Conjuntos</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                            <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                                <SelectTrigger className="w-52 bg-card border-border h-11 rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary">
                                    <SelectValue placeholder="Protocolo de Política" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                    <SelectItem value="default" className="text-xs font-medium">Protocolo Padrão CH</SelectItem>
                                    {policies.map(p => (
                                        <SelectItem key={p.id} value={p.id} className="text-xs font-medium">{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                    <Button
                        onClick={() => handleBatchAnalysis()}
                        disabled={isBatchAnalyzing}
                        className="bg-foreground text-background hover:bg-primary font-semibold rounded-xl h-12 px-6 transition-all shadow-sm dark:bg-white dark:text-black dark:hover:bg-primary"
                    >
                        {isBatchAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                        Analisar Criativos Ativos
                    </Button>

                    {/* History Drawer */}
                    <Button
                        variant="outline"
                        className="h-12 px-6 rounded-xl border-primary/20 bg-card hover:bg-primary/5 text-foreground"
                        onClick={() => setHistoryOpen(true)}
                    >
                        <History className="w-4 h-4 mr-2 text-primary" />
                        Histórico de Análises
                        <Badge className="ml-2 bg-primary/10 text-primary border-0 hover:bg-primary/20 cursor-pointer">
                            {historyEntries.length}
                        </Badge>
                    </Button>
                        </div>
                    }
                />
            </motion.div>

            {/* Creative Rules Panel — branding only */}
            {isBranding && (
            <motion.div variants={item}>
                <button
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
                                {creativeRules?.filter(r => r.is_active).length || 0} regra{(creativeRules?.filter(r => r.is_active).length || 0) !== 1 ? 's' : ''} ativa{(creativeRules?.filter(r => r.is_active).length || 0) !== 1 ? 's' : ''}
                                {!creativeRules?.length && ' — crie regras na página Regras'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {(creativeRules?.filter(r => r.is_active).length || 0) > 0 && (
                            <div className="flex -space-x-1">
                                {creativeRules?.filter(r => r.is_active).slice(0, 3).map(r => (
                                    <div key={r.id} className="w-6 h-6 rounded-full bg-ch-orange/10 border-2 border-card flex items-center justify-center">
                                        <ShieldCheck className="w-3 h-3 text-ch-orange" />
                                    </div>
                                ))}
                                {(creativeRules?.filter(r => r.is_active).length || 0) > 3 && (
                                    <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                                        <span className="text-[8px] font-semibold text-muted-foreground">+{(creativeRules?.filter(r => r.is_active).length || 0) - 3}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {showRulesPanel ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                </button>

                {showRulesPanel && (
                    <div className="mt-2 p-4 rounded-2xl border border-border bg-card space-y-3">
                        {creativeRules && creativeRules.length > 0 ? (
                            <>
                                <div className="grid gap-2">
                                    {creativeRules.map(rule => (
                                        <div key={rule.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${rule.is_active ? 'border-ch-orange/20 bg-ch-orange/5' : 'border-border bg-muted/20 opacity-60'}`}>
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <Shield className={`w-4 h-4 flex-shrink-0 ${rule.is_active ? 'text-ch-orange' : 'text-muted-foreground'}`} />
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-semibold truncate ${rule.is_active ? 'text-foreground' : 'text-muted-foreground'}`}>{rule.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-bold uppercase text-muted-foreground">{rule.rule_type === 'content' ? 'Conteúdo' : rule.rule_type === 'visual' ? 'Visual' : rule.rule_type}</span>
                                                        <span className="text-[10px] text-muted-foreground">·</span>
                                                        <span className="text-[10px] text-muted-foreground">{rule.applies_to === 'all' ? 'Todos' : rule.applies_to === 'video' ? 'Vídeo' : rule.applies_to === 'image' ? 'Imagem' : 'Carrossel'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={rule.is_active}
                                                onCheckedChange={() => toggleRule.mutate({ id: rule.id, is_active: rule.is_active })}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-border">
                                    <p className="text-[10px] text-muted-foreground">Regras ativas serão verificadas na próxima análise</p>
                                    <Button variant="ghost" size="sm" className="text-xs text-ch-orange hover:text-ch-orange/80 h-7 px-3" onClick={() => navigate('/regras')}>
                                        Gerenciar Regras
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
                                <Shield className="w-8 h-8 text-muted-foreground/30" />
                                <div>
                                    <p className="text-sm font-bold text-muted-foreground">Nenhuma regra criada</p>
                                    <p className="text-xs text-muted-foreground">Crie regras de criativo para a IA verificar durante o diagnóstico.</p>
                                </div>
                                <Button size="sm" className="bg-ch-orange text-black font-bold" onClick={() => navigate('/regras')}>
                                    Criar Regras
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
            )}

            {/* HERO SECTION */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12">

                {/* Left Column: Visual Asset & Verdict */}
                <motion.div variants={item} className="space-y-8">
                    {/* Creative Preview */}
                    <div className="relative group rounded-[2.5rem] overflow-hidden border border-border shadow-sm bg-muted aspect-video lg:aspect-[4/3] transition-all hover:shadow-md">
                        {activeAudit.creatives?.image_url ? (
                            <img
                                src={getProxiedImageUrl(activeAudit.creatives.image_url) || activeAudit.creatives.image_url}
                                alt="Creative Preview"
                                className="w-full h-full object-contain bg-black transition-transform duration-700 group-hover:scale-105"
                                onError={(e) => {
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                    target.parentElement?.querySelector('.fallback-placeholder')?.classList.remove('hidden');
                                }}
                            />
                        ) : previewIframe ? (
                            <div
                                className="w-full h-full flex items-center justify-center bg-black"
                                dangerouslySetInnerHTML={{ __html: previewIframe }}
                            />
                        ) : loadingPreview ? (
                            <div className="w-full h-full flex items-center justify-center bg-muted/10">
                                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                            </div>
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center bg-muted/10 fallback-placeholder ${activeAudit.creatives?.image_url || previewIframe || loadingPreview ? 'hidden absolute inset-0' : ''}`}>
                            <Search className="w-16 h-16 text-muted-foreground/30" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

                        <div className="absolute bottom-0 left-0 p-8 w-full">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-white/60 text-xs font-mono mb-1 uppercase tracking-wider">ID do Ativo: {activeAudit.id.slice(0, 8)}</p>
                                    <h3 className="text-3xl font-bold text-white mb-2">{activeAudit.creatives?.name}</h3>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge className="bg-white/10 hover:bg-white/20 text-white border-0 px-3 py-1">
                                            {format(new Date(activeAudit.created_at), "dd MMM yyyy", { locale: ptBR })}
                                        </Badge>
                                        {isPerformance && activeAudit.creatives?.spend != null && activeAudit.creatives.spend > 0 && (
                                            <Badge className="bg-blue-500/20 text-blue-300 border-0 px-3 py-1">
                                                Gasto: R${activeAudit.creatives.spend.toFixed(2)}
                                            </Badge>
                                        )}
                                        {scalingBadge && (
                                            <Badge className={`${scalingBadge.color} border-0 px-3 py-1`}>
                                                {scalingBadge.label}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Neural Verdict Card */}
                    <div className="p-8 rounded-[2rem] border border-border bg-card relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <BrainCircuit className="w-48 h-48" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                        <Zap className="w-6 h-6 text-amber-500" />
                                        {ai ? 'Veredito da IA' : 'Diagnóstico por Regras'}
                                    </h3>
                                    <p className="text-muted-foreground text-sm mt-1">
                                        {isBranding ? 'Score Global de Branding' : 'Score Global de Performance'}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-7xl font-semibold tracking-tighter ${getScoreColor(overallScore)}`}>
                                            {overallScore}
                                        </span>
                                        <span className="text-xl font-medium text-muted-foreground">/100</span>
                                    </div>
                                    <Badge variant="outline" className={`${getScoreBgColor(overallScore)} ${getScoreColor(overallScore)} border-0 mt-1`}>
                                        {getScoreLabel(overallScore)}
                                    </Badge>
                                </div>
                            </div>

                            {/* Tone Analysis / Summary */}
                            <div className="p-5 rounded-2xl bg-muted/50 border border-border shadow-inner mb-6">
                                <p className="text-base text-foreground/90 leading-relaxed font-medium">
                                    "{ai?.tone_analysis || (
                                        activeAudit.issues?.length
                                            ? `Análise baseada em regras: ${activeAudit.issues.length} problema(s) detectado(s). Analise os criativos ativos para obter a análise completa por IA.`
                                            : 'Nenhum problema detectado pelas regras. Analise os criativos ativos para obter a análise completa por IA.'
                                    )}"
                                </p>
                            </div>

                            {/* Performance Diagnosis — performance module only */}
                            {isPerformance && ai?.performance_diagnosis && (
                                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 mb-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BarChart3 className="w-4 h-4 text-blue-400" />
                                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Diagnóstico de Performance</span>
                                    </div>
                                    <p className="text-sm text-foreground/80 leading-relaxed">{ai.performance_diagnosis}</p>
                                </div>
                            )}

                            {/* Score Breakdown Grid */}
                            {ai && (
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Hook Power', score: hookScore, icon: Eye },
                                        { label: 'Proposta de Valor', score: valueScore, icon: Target },
                                        { label: 'Persuasão', score: persuasionScore, icon: Fingerprint },
                                        { label: 'Design Visual', score: visualScore, icon: ScanEye },
                                        { label: 'CTA', score: ctaScore, icon: MousePointerClick },
                                        { label: 'Prova Social', score: socialProofScore, icon: CheckCircle2 },
                                        { label: 'Urgência', score: urgencyScore, icon: Zap },
                                        { label: 'Target Fit', score: targetScore, icon: Target },
                                    ].map(({ label, score, icon: Icon }) => (
                                        <div key={label} className="space-y-1.5 p-3 rounded-xl bg-muted/30">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                                                    <Icon className="w-3 h-3" />
                                                    {label}
                                                </span>
                                                <span className={`font-bold ${getScoreColor(score)}`}>{score}</span>
                                            </div>
                                            <Progress value={score} className="h-1.5 bg-background" indicatorClassName={getScoreBarColor(score)} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Right Column: Deep Dive Analysis */}
                <motion.div variants={item} className="space-y-6">

                    {/* Persuasion Triggers Analysis */}
                    <div className="p-8 rounded-[2rem] border border-border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                                    <Fingerprint className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">Psicologia & Persuasão</h3>
                                    <p className="text-xs text-muted-foreground">Gatilhos de Cialdini, viés cognitivo e emocionais</p>
                                </div>
                            </div>
                            {ai && (
                                <Badge variant="outline" className={`${getScoreBgColor(persuasionScore)} ${getScoreColor(persuasionScore)} border-0`}>
                                    {getScoreLabel(persuasionScore)} {persuasionScore}/100
                                </Badge>
                            )}
                        </div>

                        <div className="space-y-4">
                            {/* Persuasion Triggers Found */}
                            {ai?.persuasion_triggers_found?.length ? (
                                <>
                                    <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> Gatilhos Detectados
                                    </p>
                                    {ai.persuasion_triggers_found.map((trigger, i) => (
                                        <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-foreground leading-relaxed">{trigger}</p>
                                        </div>
                                    ))}
                                </>
                            ) : null}

                            {/* Persuasion Triggers Missing */}
                            {ai?.persuasion_triggers_missing?.length ? (
                                <>
                                    <p className="text-xs text-rose-500 font-semibold uppercase tracking-wider flex items-center gap-1 mt-4">
                                        <TrendingDown className="w-3 h-3" /> Gatilhos Ausentes
                                    </p>
                                    {ai.persuasion_triggers_missing.map((missing, i) => (
                                        <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                                            <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-foreground leading-relaxed">{missing}</p>
                                        </div>
                                    ))}
                                </>
                            ) : null}

                            {/* Strengths (fallback for older audits) */}
                            {!ai?.persuasion_triggers_found?.length && ai?.strengths?.length ? (
                                ai.strengths.slice(0, 4).map((strength, i) => (
                                    <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-card border border-border">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-muted-foreground leading-relaxed">{strength}</p>
                                    </div>
                                ))
                            ) : null}

                            {/* Rule-based issues when no AI */}
                            {!ai && (activeAudit.issues?.length ?? 0) > 0 && (
                                <div className="space-y-3">
                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Problemas Detectados por Regras</p>
                                    {activeAudit.issues!.map((issue: { message: string; severity: string }, i: number) => (
                                        <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-card border border-border">
                                            <Badge variant="outline" className={`${issue.severity === 'error' ? 'bg-rose-500/10 text-rose-500' : issue.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'} border-0 text-[10px]`}>
                                                {issue.severity}
                                            </Badge>
                                            <p className="text-sm text-muted-foreground">{issue.message}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Empty state */}
                            {!ai && !(activeAudit.issues?.length) && (
                                <p className="text-sm text-muted-foreground">Analise os criativos ativos para obter análise de persuasão por IA.</p>
                            )}
                        </div>
                    </div>

                    {/* Visual Architecture */}
                    <div className="p-8 rounded-[2rem] border border-border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                                    <ScanEye className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">Arquitetura Visual</h3>
                                    <p className="text-xs text-muted-foreground">Composição, hierarquia e legibilidade</p>
                                </div>
                            </div>
                            {ai && (
                                <Badge variant="outline" className={`${getScoreBgColor(visualScore)} ${getScoreColor(visualScore)} border-0`}>
                                    {getScoreLabel(visualScore)} {visualScore}/100
                                </Badge>
                            )}
                        </div>

                        {ai?.visual_analysis ? (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-muted-foreground">Contraste & Legibilidade</span>
                                        <Badge variant="outline" className={`${getScoreBgColor(ai.visual_analysis.contrast_readability ?? 0)} ${getScoreColor(ai.visual_analysis.contrast_readability ?? 0)} border-0 text-[10px] px-2`}>
                                            {getScoreLabel(ai.visual_analysis.contrast_readability ?? 0)}
                                        </Badge>
                                    </div>
                                    <Progress value={ai.visual_analysis.contrast_readability ?? 0} className="h-1.5 bg-background" indicatorClassName={getScoreBarColor(ai.visual_analysis.contrast_readability ?? 0)} />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-muted-foreground">Hierarquia da Informação</span>
                                        <Badge variant="outline" className={`${getScoreBgColor(ai.visual_analysis.information_hierarchy ?? 0)} ${getScoreColor(ai.visual_analysis.information_hierarchy ?? 0)} border-0 text-[10px] px-2`}>
                                            {getScoreLabel(ai.visual_analysis.information_hierarchy ?? 0)}
                                        </Badge>
                                    </div>
                                    <Progress value={ai.visual_analysis.information_hierarchy ?? 0} className="h-1.5 bg-background" indicatorClassName={getScoreBarColor(ai.visual_analysis.information_hierarchy ?? 0)} />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-muted-foreground">Otimização Mobile</span>
                                        <Badge variant="outline" className={`${getScoreBgColor(ai.visual_analysis.mobile_optimization ?? 0)} ${getScoreColor(ai.visual_analysis.mobile_optimization ?? 0)} border-0 text-[10px] px-2`}>
                                            {getScoreLabel(ai.visual_analysis.mobile_optimization ?? 0)}
                                        </Badge>
                                    </div>
                                    <Progress value={ai.visual_analysis.mobile_optimization ?? 0} className="h-1.5 bg-background" indicatorClassName={getScoreBarColor(ai.visual_analysis.mobile_optimization ?? 0)} />
                                </div>

                                {/* Visual metadata */}
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {ai.visual_analysis.text_overlay_ratio && (
                                        <Badge variant="outline" className="text-[10px] border-border bg-card">
                                            Texto: {ai.visual_analysis.text_overlay_ratio}
                                        </Badge>
                                    )}
                                    {ai.visual_analysis.has_human_face !== undefined && (
                                        <Badge variant="outline" className={`text-[10px] border-0 ${ai.visual_analysis.has_human_face ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            {ai.visual_analysis.has_human_face ? 'Rosto Humano Presente' : 'Sem Rosto Humano'}
                                        </Badge>
                                    )}
                                </div>

                                {ai.visual_analysis.composition_notes && (
                                    <div className="p-4 rounded-xl bg-muted/30 border border-border">
                                        <p className="text-xs text-muted-foreground leading-relaxed">{ai.visual_analysis.composition_notes}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Analise os criativos ativos para obter análise visual detalhada por IA.</p>
                        )}
                    </div>

                    {/* Creative Rules Compliance — branding only */}
                    {isBranding && (
                    <div className="p-8 rounded-[2rem] border border-border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">Compliance de Regras</h3>
                                    <p className="text-xs text-muted-foreground">Verificação das regras personalizadas criadas</p>
                                </div>
                            </div>
                            {ruleCheck && (
                                <Badge variant="outline" className={`${
                                    ruleCheck.overall_status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                                    ruleCheck.overall_status === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                                    'bg-rose-500/10 text-rose-500'
                                } border-0`}>
                                    {ruleCheck.overall_status === 'approved' ? 'Aprovado' :
                                     ruleCheck.overall_status === 'warning' ? 'Atenção' : 'Reprovado'}
                                    {' '}{ruleCheck.overall_score}/100
                                </Badge>
                            )}
                        </div>

                        <div className="space-y-4">
                            {loadingRuleCheck ? (
                                <div className="flex items-center gap-2 text-muted-foreground py-4">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Carregando verificação de regras...</span>
                                </div>
                            ) : ruleCheck?.results?.length ? (
                                <>
                                    {ruleCheck.ai_summary && (
                                        <div className="p-4 rounded-2xl bg-muted/50 border border-border shadow-inner mb-4">
                                            <p className="text-sm text-foreground/90 leading-relaxed">{ruleCheck.ai_summary}</p>
                                        </div>
                                    )}
                                    {ruleCheck.results.map((result, i) => (
                                        <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-card border border-border hover:bg-muted/50 transition-colors">
                                            {result.passed ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                            ) : result.severity === 'error' ? (
                                                <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-sm font-bold text-foreground">{result.rule_name}</h4>
                                                    <Badge variant="outline" className={`text-[10px] border-0 ${
                                                        result.passed ? 'bg-emerald-500/10 text-emerald-500' :
                                                        result.severity === 'error' ? 'bg-rose-500/10 text-rose-500' :
                                                        'bg-amber-500/10 text-amber-500'
                                                    }`}>
                                                        {result.passed ? 'OK' : result.severity === 'error' ? 'Falha' : 'Alerta'}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground leading-relaxed">{result.reason}</p>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : ai?.rules_compliance?.length ? (
                                /* Fallback: show AI-evaluated rules compliance */
                                ai.rules_compliance.map((rc, i) => (
                                    <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-card border border-border">
                                        {rc.passed ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-bold text-foreground">{rc.rule_name}</h4>
                                                <Badge variant="outline" className={`text-[10px] border-0 ${rc.passed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                    {rc.passed ? 'OK' : 'Falha'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed">{rc.reason}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Nenhuma verificação de regras disponível. Analise os criativos ativos para verificar as regras criadas.
                                </p>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Action Plan */}
                    <div className="p-8 rounded-[2rem] border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
                                <Target className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Plano de Correção</h3>
                                <p className="text-xs text-muted-foreground">Ações imediatas para recuperar performance</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Action Plan from AI (prioritized) */}
                            {ai?.action_plan?.length ? (
                                ai.action_plan.map((action, i) => (
                                    <div key={i} className="flex gap-4 items-start">
                                        <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-rose-500 mt-0.5">
                                            {i + 1}
                                        </div>
                                        <p className="text-sm text-foreground font-medium">{action}</p>
                                    </div>
                                ))
                            ) : ai?.weaknesses?.length ? (
                                ai.weaknesses.map((weakness, i) => (
                                    <div key={i} className="flex gap-4 items-start">
                                        <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-rose-500 mt-0.5">
                                            {i + 1}
                                        </div>
                                        <p className="text-sm text-foreground font-medium">{weakness}</p>
                                    </div>
                                ))
                            ) : (activeAudit.recommendations?.length ?? 0) > 0 ? (
                                activeAudit.recommendations!.map((rec: string, i: number) => (
                                    <div key={i} className="flex gap-4 items-start">
                                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-amber-500 mt-0.5">
                                            {i + 1}
                                        </div>
                                        <p className="text-sm text-foreground font-medium">{rec}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center gap-2 text-emerald-500 py-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="text-sm font-medium">Nenhum ponto crítico detectado. Ótimo trabalho!</span>
                                </div>
                            )}

                            {/* Policy Warnings */}
                            {ai?.policy_warnings?.length ? (
                                <div className="mt-4 pt-4 border-t border-rose-500/10">
                                    <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Alertas de Política do Meta
                                    </p>
                                    {ai.policy_warnings.map((warning, i) => (
                                        <div key={i} className="flex gap-3 items-start mb-2">
                                            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-rose-300">{warning}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {/* Campaign Action Buttons — performance only */}
                            {isPerformance && activeAudit.creatives?.campaigns && (
                                <div className="mt-6 pt-6 border-t border-border">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                                        <Zap className="w-3 h-3 text-ch-orange" /> Ações Rápidas
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        {(activeAudit.creatives.campaigns as any).status !== 'PAUSED' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const campId = (activeAudit.creatives!.campaigns as any)?.id;
                                                    if (!campId) return;
                                                    campaignAction.mutate({ campaign_id: campId, action: 'pause' });
                                                }}
                                                disabled={campaignAction.isPending}
                                                className="rounded-xl font-bold text-xs gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                                            >
                                                {campaignAction.isPending && campaignAction.variables?.action === 'pause' ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <PauseCircle className="w-3.5 h-3.5" />
                                                )}
                                                Pausar Campanha
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                const camp = activeAudit.creatives!.campaigns as any;
                                                setNewBudgetValue(String(camp?.daily_budget || 0));
                                                setBudgetDialogOpen(true);
                                            }}
                                            disabled={campaignAction.isPending}
                                            className="rounded-xl font-bold text-xs gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                            {campaignAction.isPending && campaignAction.variables?.action === 'update_budget' ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Wallet className="w-3.5 h-3.5" />
                                            )}
                                            Aumentar Verba
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </motion.div>
            </div>

            {/* Performance Violations Banner — performance only */}
            {isPerformance && perfViolations.violations.length > 0 && (
                <motion.div variants={item} className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-rose-500 flex-shrink-0" />
                        <p className="text-sm font-bold text-rose-500">
                            {perfViolations.violations.length} regra(s) de performance violada(s) neste criativo
                        </p>
                    </div>
                    <div className="space-y-2 pl-8">
                        {perfViolations.violations.map((v, i) => {
                            const fmtValue = v.metric === 'cpc' || v.metric === 'spend'
                                ? `R$ ${v.current.toFixed(2)}`
                                : v.metric === 'ctr'
                                    ? `${v.current.toFixed(2)}%`
                                    : String(Math.round(v.current));
                            const fmtThreshold = v.metric === 'cpc' || v.metric === 'spend'
                                ? `R$ ${v.threshold}`
                                : v.metric === 'ctr'
                                    ? `${v.threshold}%`
                                    : String(v.threshold);
                            const opSymbol = v.operator === 'lt' || v.operator === 'less_than' ? '<' : v.operator === 'lte' ? '≤' : v.operator === 'gt' || v.operator === 'greater_than' ? '>' : v.operator === 'gte' ? '≥' : '=';
                            return (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="text-rose-400 font-medium">{v.rule_name}</span>
                                    <span className="text-rose-400/70">
                                        {v.metric.toUpperCase()} = {fmtValue} (limite: {opSymbol} {fmtThreshold})
                                        {v.action_type === 'pause_campaign' ? ' → Pausar' : v.action_type === 'notify' ? ' → Notificar' : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Metric Cards Grid — performance only */}
            {isPerformance && activeAudit.creatives && (
                <motion.div variants={item}>
                    <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-ch-orange rounded-full" /> Métricas do Criativo
                    </h3>
                    <div className={cn('grid gap-4', statsGridCols[6])}>
                        {[
                            { label: 'Gasto', value: formatCurrency(Number(activeAudit.creatives.spend) || 0), icon: DollarSign, color: 'emerald-500' },
                            { label: 'Impressões', value: formatNumber(Number(activeAudit.creatives.impressions) || 0), icon: Eye, color: 'blue-500' },
                            { label: 'Cliques', value: formatNumber(Number(activeAudit.creatives.clicks) || 0), icon: MousePointerClick, color: 'amber-500' },
                            { label: 'CTR', value: formatPercent(Number(activeAudit.creatives.ctr) || 0), icon: TrendingUp, color: 'ch-orange' },
                            { label: 'CPC', value: formatCurrency(Number(activeAudit.creatives.cpc) || 0), icon: Target, color: 'blue-400' },
                            { label: 'Resultado', value: formatNumber(Number(activeAudit.creatives.conversions) || 0), icon: Award, color: 'emerald-600' },
                        ].map((metric) => {
                            const metricKey = metricLabelToKey[metric.label];
                            const isViolated = metricKey ? perfViolations.violatedMetrics.has(metricKey) : false;
                            const violation = isViolated ? perfViolations.violations.find(v => v.metric === metricKey) : null;
                            const displayColor = isViolated ? 'rose-500' : metric.color;

                            return (
                                <div
                                    key={metric.label}
                                    className={`rounded-2xl p-5 border bg-card shadow-sm group ${
                                        isViolated
                                            ? 'border-2 border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/10'
                                            : 'border-border'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`p-1.5 bg-${displayColor}/10 rounded-lg`}>
                                            <metric.icon className={`w-3.5 h-3.5 text-${displayColor}`} />
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isViolated ? 'text-rose-400' : 'text-muted-foreground'}`}>{metric.label}</span>
                                        {isViolated && <AlertTriangle className="w-3 h-3 text-rose-500 ml-auto" />}
                                    </div>
                                    <p className={`text-xl font-bold tabular-nums ${isViolated ? 'text-rose-500' : 'text-foreground'}`}>{metric.value}</p>
                                    {violation && (
                                        <p className="text-[9px] text-rose-400 mt-1.5 font-medium leading-tight">
                                            {violation.rule_name}: limite {violation.operator === 'lt' || violation.operator === 'less_than' ? '<' : violation.operator === 'lte' ? '≤' : violation.operator === 'gt' || violation.operator === 'greater_than' ? '>' : violation.operator === 'gte' ? '≥' : '='}{' '}
                                            {violation.metric === 'cpc' || violation.metric === 'spend' ? `R$ ${violation.threshold}` : violation.metric === 'ctr' ? `${violation.threshold}%` : violation.threshold}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Performance Rules Section — performance only */}
            {isPerformance && performanceRules && performanceRules.length > 0 && activeAudit.creatives && (
                <motion.div variants={item} className="p-8 rounded-[2rem] border border-border bg-card">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                                <Activity className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Regras de Performance</h3>
                                <p className="text-xs text-muted-foreground">Avaliação automática das métricas contra suas regras</p>
                            </div>
                        </div>
                        <Badge variant="outline" className={`${
                            perfViolations.violations.length === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                        } border-0`}>
                            {perfViolations.violations.length === 0 ? 'Todas OK' : `${perfViolations.violations.length} violação(ões)`}
                        </Badge>
                    </div>

                    <div className="space-y-3">
                        {performanceRules.map((rule: any) => {
                            const cond = rule.trigger_conditions;
                            if (!cond?.metric) return null;
                            const c = activeAudit.creatives!;
                            const metricValues: Record<string, number> = {
                                ctr: Number(c.ctr) || 0, cpc: Number(c.cpc) || 0, spend: Number(c.spend) || 0,
                                impressions: Number(c.impressions) || 0, clicks: Number(c.clicks) || 0, conversions: Number(c.conversions) || 0,
                            };
                            const current = metricValues[cond.metric] ?? 0;
                            const threshold = Number(cond.threshold);
                            let triggered = false;
                            if (cond.operator === 'lt' || cond.operator === 'less_than') triggered = current < threshold;
                            else if (cond.operator === 'lte') triggered = current <= threshold;
                            else if (cond.operator === 'gt' || cond.operator === 'greater_than') triggered = current > threshold;
                            else if (cond.operator === 'gte') triggered = current >= threshold;
                            else if (cond.operator === 'equal') triggered = current === threshold;

                            const isMonetary = cond.metric === 'cpc' || cond.metric === 'spend';
                            const isPercent = cond.metric === 'ctr';
                            const fmtVal = isMonetary ? `R$ ${current.toFixed(2)}` : isPercent ? `${current.toFixed(2)}%` : String(Math.round(current));
                            const fmtThresh = isMonetary ? `R$ ${threshold}` : isPercent ? `${threshold}%` : String(threshold);
                            const opSymbol = cond.operator === 'lt' || cond.operator === 'less_than' ? '<' : cond.operator === 'lte' ? '≤' : cond.operator === 'gt' || cond.operator === 'greater_than' ? '>' : cond.operator === 'gte' ? '≥' : '=';

                            return (
                                <div key={rule.id} className={`flex items-start gap-3 p-4 rounded-2xl border ${
                                    triggered
                                        ? 'bg-rose-500/5 border-rose-500/20'
                                        : 'bg-emerald-500/5 border-emerald-500/20'
                                }`}>
                                    {triggered ? (
                                        <div className="mt-0.5 bg-rose-500/20 rounded-full p-0.5">
                                            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                        </div>
                                    ) : (
                                        <div className="mt-0.5 bg-emerald-500/20 rounded-full p-0.5">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className={`text-sm font-bold ${triggered ? 'text-rose-400' : 'text-emerald-400'}`}>{rule.name}</h4>
                                            <Badge variant="outline" className={`text-[10px] border-0 ${triggered ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                {triggered ? 'Violada' : 'OK'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {cond.metric.toUpperCase()} atual: {fmtVal} — {triggered ? 'viola' : 'dentro da'} regra (limite: {opSymbol} {fmtThresh})
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Analysis Overlay */}
            {batchOverlay}

            {/* Budget Increase Dialog */}
            {budgetDialogOpen && activeAudit?.creatives?.campaigns && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setBudgetDialogOpen(false)}>
                    <div className="bg-card border border-border rounded-2xl shadow-sm w-full max-w-md p-6 space-y-4 mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10">
                                <Wallet className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Aumentar Verba Diária</h3>
                                <p className="text-xs text-muted-foreground">
                                    Campanha: {(activeAudit.creatives.campaigns as any)?.name}
                                </p>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Verba atual: <span className="font-semibold text-foreground">{formatCurrency((activeAudit.creatives.campaigns as any)?.daily_budget || 0)}</span>
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nova verba diária (R$)</label>
                            <input
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
                                const currentBudget = (activeAudit.creatives!.campaigns as any)?.daily_budget || 0;
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
                                    const campId = (activeAudit.creatives!.campaigns as any)?.id;
                                    if (!campId || !newBudgetValue) return;
                                    const budgetInCents = Math.round(parseFloat(newBudgetValue) * 100);
                                    campaignAction.mutate(
                                        {
                                            campaign_id: campId,
                                            action: 'update_budget',
                                            payload: { daily_budget: budgetInCents },
                                        },
                                        { onSuccess: () => setBudgetDialogOpen(false) }
                                    );
                                }}
                                disabled={campaignAction.isPending || !newBudgetValue || parseFloat(newBudgetValue) <= 0}
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
            {historySheetPanel}
            {isPerformance && selectedEntityAudit && (
                <PerformanceEntityAuditDialog
                    open={entityDialogOpen}
                    onOpenChange={setEntityDialogOpen}
                    audit={selectedEntityAudit}
                    entityName={getHistoryEntryName(selectedEntityAudit)}
                    entityLevel={entityDialogLevel}
                />
            )}
        </motion.div>
    );
}
