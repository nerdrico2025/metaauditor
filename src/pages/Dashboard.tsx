import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { useCompanyMetrics, MetricsPeriod } from '@/hooks/useCompanyMetrics';
import { useCreativePerformance } from '@/hooks/useCreativePerformance';
import { useAccountHealth } from '@/hooks/useAccountHealth';
import { useCompanyIntegrations } from '@/hooks/useCompanyIntegrations';
import { useCompany } from '@/hooks/useCompany';
import {
    AlertTriangle, ArrowUpRight, ArrowDownRight,
    RefreshCw, ChevronRight, Sparkles, ShieldCheck, Brain, Activity, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useComplianceSummary } from '@/hooks/useCreativeRules';
import { useMonitoredCampaignScope } from '@/hooks/useMonitoredCampaignScope';
import { usePerformanceCompliance } from '@/hooks/usePerformanceCompliance';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { useModule } from '@/contexts/ModuleContext';
import { SectionHeader } from '@/components/ui/section-header';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getAccentColor, motionVariants } from '@/lib/motion-presets';
import { BrandBriefingWizard } from '@/components/branding/BrandBriefingWizard';
import { SelectRuleDialog } from '@/components/branding/SelectRuleDialog';
import { ComplianceReportOverlay } from '@/components/branding/ComplianceReportOverlay';
import { useBrandingAnalysis } from '@/hooks/useBrandingAnalysis';
import { useBrandingCompliance } from '@/hooks/useBrandingCompliance';
import { BrandingCounts } from '@/components/branding/BrandingCounts';
import { BatchCheckResultItem } from '@/hooks/useBatchCreativeRuleCheck';
import { SyncLikeOverlay } from '@/components/common/SyncLikeOverlay';
import {
    BRANDING_STEPS,
    mapFractionToStepIndex,
    mapProgressRange,
} from '@/components/common/syncLikeOverlayPresets';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function useAccentColor(): string {
    const { module } = useModule();
    const [color, setColor] = useState(() => getAccentColor());
    useEffect(() => {
        setColor(getAccentColor());
    }, [module]);
    return color;
}

function FunnelBar({ width, colorClass }: { width: number; colorClass: string }) {
    const reduced = useReducedMotion();
    return (
        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
            <motion.div
                className={cn(`h-full rounded-full ${colorClass}`)}
                initial={{ width: reduced ? `${Math.max(width, 0.5)}%` : '0%' }}
                animate={{ width: `${Math.max(width, 0.5)}%` }}
                transition={{ duration: reduced ? 0 : 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            />
        </div>
    );
}

const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, trend: 'neutral' as const };
    const delta = ((current - previous) / previous) * 100;
    return { value: Math.abs(delta), trend: delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'neutral' as const };
};

// ─── Trend badge ────────────────────────────────────────────────────────────────

function Trend({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
    const { value, trend } = calcTrend(current, previous);
    if (trend === 'neutral') return <span className="text-[11px] text-muted-foreground">= vs. anterior</span>;
    const positive = invert ? trend === 'down' : trend === 'up';
    const color = positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
    const Icon = trend === 'up' ? ArrowUpRight : ArrowDownRight;
    return (
        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${color}`}>
            <Icon className="h-3 w-3" />{value.toFixed(1)}% <span className="text-muted-foreground font-normal">vs. anterior</span>
        </span>
    );
}

// ═════════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { effectiveIds } = useIntegrationFilter();
    const { range: dateFilterRange } = useDateFilter();
    const { module } = useModule();
    const accentColor = useAccentColor();
    const reduced = useReducedMotion();
    const { fadeUp: fadeUpVariant, staggerContainer: staggerAnim } = motionVariants(reduced);

    // ─── Data (UNTOUCHED) ───────────────────────────────────────────────────────
    const { data: integrations } = useCompanyIntegrations(user?.company_id);
    const { data: company } = useCompany();
    const isAdmin = user?.role === 'company_admin' || user?.role === 'super_admin';
    const aiContextEmpty = isAdmin && (!company?.ai_context || Object.keys(company.ai_context).length === 0);
    // Map global date filter to MetricsPeriod expected by useCompanyMetrics.
    // When no range is set ("Todo o período") we fall back to 90 days for a sensible default view.
    const effectivePeriod: MetricsPeriod = dateFilterRange.isAll || !dateFilterRange.startDate || !dateFilterRange.endDate
        ? '90d'
        : { from: new Date(dateFilterRange.startDate + 'T00:00:00'), to: new Date(dateFilterRange.endDate + 'T23:59:59') };
    const { data: campaignScope, isLoading: scopeLoading } = useMonitoredCampaignScope(effectiveIds);
    const { data: metrics, isLoading: metricsLoading } = useCompanyMetrics(
        effectivePeriod,
        undefined,
        effectiveIds,
        campaignScope ?? null,
        scopeLoading,
    );
    const { data: creativeData, isLoading: creativeLoading } = useCreativePerformance(
        effectivePeriod,
        undefined,
        effectiveIds,
        campaignScope ?? null,
        scopeLoading,
    );
    const { data: accountHealth } = useAccountHealth();
    const { data: compliance, isLoading: complianceLoading } = useComplianceSummary(
        effectiveIds,
        campaignScope ?? null,
        scopeLoading,
    );
    const { runFullAnalysis, isRunning: isBrandingAnalysisRunning, activeRulesCount, isBriefingComplete } = useBrandingAnalysis();

    const [wizardOpen, setWizardOpen] = useState(false);
    const [ruleSelectorOpen, setRuleSelectorOpen] = useState(false);
    const [complianceOverlayOpen, setComplianceOverlayOpen] = useState(false);
    const [complianceOverlayItems, setComplianceOverlayItems] = useState<BatchCheckResultItem[]>([]);
    const [complianceApprovedCount, setComplianceApprovedCount] = useState(0);
    const [hadBriefingOnStart, setHadBriefingOnStart] = useState(false);
    const [brandingOverlayOpen, setBrandingOverlayOpen] = useState(false);
    const [brandingOverlayProgress, setBrandingOverlayProgress] = useState(0);
    const [brandingOverlayFinished, setBrandingOverlayFinished] = useState(false);
    const [brandingStepIndex, setBrandingStepIndex] = useState(0);
    const [brandingStepDetail, setBrandingStepDetail] = useState('');
    const [brandingOverlayTotal, setBrandingOverlayTotal] = useState(0);
    const [brandingOverlayCurrent, setBrandingOverlayCurrent] = useState(0);

    const openRuleSelectorOrWarn = useCallback(() => {
        if (activeRulesCount === 0) {
            toast.error('Nenhuma regra de branding ativa. Crie regras em Regras de Branding.', {
                action: { label: 'Ir para Regras', onClick: () => navigate('/regras') },
            });
            return;
        }
        setRuleSelectorOpen(true);
    }, [activeRulesCount, navigate]);

    const startBrandingAnalysis = useCallback(() => {
        const complete = isBriefingComplete(company);
        setHadBriefingOnStart(complete);
        if (!complete) {
            setWizardOpen(true);
            return;
        }
        openRuleSelectorOrWarn();
    }, [company, isBriefingComplete, openRuleSelectorOrWarn]);

    const onBriefingComplete = useCallback(() => {
        openRuleSelectorOrWarn();
    }, [openRuleSelectorOrWarn]);

    const onRulesSelected = useCallback(async (ruleIds: string[]) => {
        setRuleSelectorOpen(false);
        setBrandingOverlayOpen(true);
        setBrandingOverlayFinished(false);
        setBrandingOverlayProgress(0);
        setBrandingStepIndex(0);
        setBrandingStepDetail('Preparando regras de branding...');
        setBrandingOverlayTotal(0);
        setBrandingOverlayCurrent(0);

        try {
            const bootstrapStart = Date.now();
            while (Date.now() - bootstrapStart < 1500) {
                setBrandingOverlayProgress(Math.round(((Date.now() - bootstrapStart) / 1500) * 10));
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            const { results, nonCompliant } = await runFullAnalysis({
                ruleIds,
                integrationIds: effectiveIds,
                onProgress: (p) => {
                    setBrandingOverlayTotal(p.total);
                    setBrandingOverlayCurrent(p.current);
                    setBrandingOverlayProgress(mapProgressRange(p.current, p.total, 10, 90));
                    setBrandingStepIndex(mapFractionToStepIndex(p.current / p.total, BRANDING_STEPS.length));
                    setBrandingStepDetail(`${p.creativeName} (${p.current}/${p.total})`);
                },
            });

            setBrandingOverlayFinished(true);
            setBrandingStepIndex(BRANDING_STEPS.length - 1);
            setBrandingStepDetail('Concluído!');
            for (let p = 90; p <= 100; p += 2) {
                setBrandingOverlayProgress(p);
                await new Promise((resolve) => setTimeout(resolve, 80));
            }
            await new Promise((resolve) => setTimeout(resolve, 800));

            setComplianceApprovedCount(results.length - nonCompliant.length);
            setComplianceOverlayItems(nonCompliant);
            if (nonCompliant.length > 0) {
                setComplianceOverlayOpen(true);
            } else if (results.length > 0) {
                toast.success('Todos os criativos estão em conformidade com a marca!');
            }
        } catch {
            /* toast handled in hook */
        } finally {
            setBrandingOverlayOpen(false);
            setBrandingOverlayFinished(false);
            setBrandingOverlayProgress(0);
            setBrandingStepIndex(0);
            setBrandingStepDetail('');
        }
    }, [runFullAnalysis, effectiveIds]);
    const { data: perfCompliance, isLoading: perfComplianceLoading } = usePerformanceCompliance();
    const { data: brandingCompliance } = useBrandingCompliance();

    const monitoredCampaignCount = campaignScope?.validCampaignIds.length ?? 0;

    const { data: scopedCampaignNames } = useQuery({
        queryKey: ['dashboard-branding-campaign-names', user?.company_id, campaignScope?.validCampaignIds.length],
        queryFn: async () => {
            const ids = campaignScope?.validCampaignIds ?? [];
            if (ids.length === 0) return [];
            const { data, error } = await supabase
                .from('campaigns')
                .select('id, name')
                .in('id', ids.slice(0, 100));
            if (error) throw error;
            return data ?? [];
        },
        enabled: module === 'branding' && monitoredCampaignCount > 0,
        staleTime: 60_000,
    });

    const brandingCampaignHighlights = useMemo(() => {
        if (!brandingCompliance || !scopedCampaignNames?.length) return [];
        return scopedCampaignNames
            .map((c) => ({
                id: c.id,
                name: c.name,
                counts: brandingCompliance.byCampaign.get(c.id),
            }))
            .filter((row) => row.counts && row.counts.total_creatives > 0)
            .sort((a, b) => (b.counts?.rejected ?? 0) - (a.counts?.rejected ?? 0))
            .slice(0, 4);
    }, [brandingCompliance, scopedCampaignNames]);

    const perfRuleSummary = useMemo(() => {
        if (!perfCompliance) return null;
        const { byCreative, violationsByCreative, adLevelRules } = perfCompliance;
        if (adLevelRules.length === 0) {
            return { hasRules: false as const };
        }
        let approved = 0;
        let rejected = 0;
        for (const status of byCreative.values()) {
            if (status === 'approved') approved++;
            else if (status === 'rejected') rejected++;
        }
        const total = approved + rejected;
        const ruleCountMap = new Map<string, number>();
        for (const violations of violationsByCreative.values()) {
            for (const v of violations) {
                ruleCountMap.set(v.rule_name, (ruleCountMap.get(v.rule_name) || 0) + 1);
            }
        }
        const top_violated_rules = [...ruleCountMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([rule_name, count]) => ({ rule_name, count }));

        return {
            hasRules: true as const,
            total,
            approved,
            rejected,
            activeRules: adLevelRules.length,
            top_violated_rules,
        };
    }, [perfCompliance]);

    // Sync stale (UNTOUCHED)
    const stale = (() => {
        if (!integrations || integrations.length === 0) return null;
        const active = integrations.filter(i => i.status === 'active');
        if (active.length === 0) return null;
        const dates = active.map(i => i.last_sync_at ? new Date(i.last_sync_at).getTime() : 0).filter(d => d > 0);
        if (dates.length === 0) return 'Seus dados nunca foram sincronizados. Sincronize para ver métricas.';
        const days = Math.floor((Date.now() - Math.max(...dates)) / 86400000);
        return days >= 2 ? `Dados desatualizados (${days} dias). Sincronize para métricas precisas.` : null;
    })();

    const m = metrics;
    const prev = m?.previousPeriod;

    // Memoize chart data to avoid expensive Recharts SVG re-renders.
    // Fills missing days with 0 so the X axis honors the full requested period
    // (Meta's insights API has a 1–2 day lag; days near "today" are absent
    // from campaign_metrics and would silently disappear from the chart).
    const chartData = useMemo(() => {
        if (!m?.dailyData) return [];
        const fmtKey = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const labelOf = (d: Date) =>
            d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

        const byDate = new Map<string, any>();
        for (const d of m.dailyData) byDate.set(d.date, d);

        // Determine the requested range. Mirrors useCompanyMetrics' fallback to 90d.
        let start: Date;
        let end: Date;
        if (typeof effectivePeriod === 'string') {
            const days = parseInt(effectivePeriod);
            end = new Date(); end.setDate(end.getDate() - 1); end.setHours(0, 0, 0, 0);
            start = new Date(end); start.setDate(end.getDate() - days + 1);
        } else {
            start = new Date(effectivePeriod.from); start.setHours(0, 0, 0, 0);
            end = new Date(effectivePeriod.to); end.setHours(0, 0, 0, 0);
        }

        const out: any[] = [];
        const cursor = new Date(start);
        while (cursor.getTime() <= end.getTime()) {
            const key = fmtKey(cursor);
            const existing = byDate.get(key);
            out.push({
                date: key,
                label: labelOf(cursor),
                spend: existing?.spend ?? 0,
                impressions: existing?.impressions ?? 0,
                clicks: existing?.clicks ?? 0,
                conversions: existing?.conversions ?? 0,
                ctr: existing?.ctr ?? 0,
                cpc: existing?.cpc ?? 0,
                cpm: existing?.cpm ?? 0,
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        return out;
    }, [m?.dailyData, effectivePeriod]);

    return (
        <motion.div initial={reduced ? false : 'hidden'} animate="visible" variants={staggerAnim} className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">

            {/* Sync warning — admin only (D2): user comum não precisa lidar com sync */}
            {stale && isAdmin && (
                <motion.div variants={fadeUpVariant} className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200">
                    <RefreshCw className="h-4 w-4 flex-shrink-0" />
                    <p className="text-sm flex-1">{stale}</p>
                    <Button size="sm" variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-xs" onClick={() => navigate('/integracoes')}>Sincronizar</Button>
                </motion.div>
            )}

            {/* AI context onboarding nudge */}
            {aiContextEmpty && (
                <motion.div variants={fadeUpVariant} className="flex items-center gap-3 p-3 rounded-xl border border-ch-orange/30 bg-ch-orange/5 text-foreground">
                    <Brain className="h-4 w-4 flex-shrink-0 text-ch-orange" />
                    <p className="text-sm flex-1">
                        Personalize a IA: descreva seu negócio, público e metas em <span className="font-semibold">Configurações → Contexto da IA</span> para receber feedback específico e não genérico.
                    </p>
                    <Button size="sm" variant="outline" className="border-ch-orange/40 text-ch-orange hover:bg-ch-orange/10 text-xs" onClick={() => navigate('/contexto')}>Configurar</Button>
                </motion.div>
            )}

            {/* Header */}
            <motion.div variants={fadeUpVariant}>
                <SectionHeader
                    title="Visão geral"
                    description={module === 'performance' ? 'Performance — investimento, conversão e eficiência' : 'Branding — conformidade e saúde visual'}
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            {module === 'branding' && (
                                <Button
                                    size="sm"
                                    onClick={startBrandingAnalysis}
                                    disabled={isBrandingAnalysisRunning}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                >
                                    {isBrandingAnalysisRunning ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Sparkles className="h-4 w-4 mr-2" />
                                    )}
                                    Análise de Branding
                                </Button>
                            )}
                            <DateRangeFilter />
                        </div>
                    }
                />
            </motion.div>

            {/* Alerts */}
            <AnimatePresence>
                {accountHealth?.alerts?.map((a: any, i: number) => (
                    <motion.div key={i} variants={fadeUpVariant} className={`flex items-center gap-2 p-3 rounded-xl text-sm ${a.type === 'error' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20'}`}>
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />{a.message}
                    </motion.div>
                ))}
            </AnimatePresence>

            {metricsLoading && !m && module === 'performance' && (
                <motion.div variants={fadeUpVariant}>
                    <KpiStrip columns={6} isLoading items={[]} />
                </motion.div>
            )}

            {/* ══════════ PERFORMANCE ══════════ */}
            {module === 'performance' && m && (
                <>
                    <motion.div variants={fadeUpVariant}>
                        <KpiStrip
                            columns={6}
                            items={[
                                {
                                    label: 'Investido',
                                    value: formatCurrency(m.totalSpend),
                                    trend: <Trend current={m.totalSpend} previous={prev?.totalSpend ?? 0} invert />,
                                    tooltip: 'Soma do gasto (spend) de todos os anúncios ativos e pausados no período. Vem do insights da Meta (campo spend), em BRL.',
                                },
                                {
                                    label: 'Impressões',
                                    value: formatNumber(m.totalImpressions),
                                    trend: <Trend current={m.totalImpressions} previous={prev?.totalImpressions ?? 0} />,
                                    tooltip: 'Quantas vezes seus anúncios foram exibidos no período (campo impressions da Meta).',
                                },
                                {
                                    label: 'Cliques',
                                    value: formatNumber(m.totalInlineLinkClicks),
                                    trend: <Trend current={m.totalInlineLinkClicks} previous={prev?.totalInlineLinkClicks ?? 0} />,
                                    tooltip: 'Cliques no link de destino (mesma métrica usada no CTR Link).',
                                },
                                {
                                    label: 'Conversão',
                                    value: formatNumber(m.totalConversions),
                                    trend: <Trend current={m.totalConversions} previous={prev?.totalConversions ?? 0} />,
                                    tooltip: 'Total de resultados atribuídos no período, com deduplicação de action_types.',
                                },
                                {
                                    label: 'CTR (Link)',
                                    value: `${m.avgLinkCtr.toFixed(2)}%`,
                                    trend: <Trend current={m.avgLinkCtr} previous={prev?.avgLinkCtr ?? 0} />,
                                    tooltip: 'Cliques no link ÷ impressões × 100.',
                                },
                                {
                                    label: 'CPC Médio',
                                    value: formatCurrency(m.avgCpc),
                                    trend: <Trend current={m.avgCpc} previous={prev?.avgCpc ?? 0} invert />,
                                    tooltip: 'Investido ÷ Cliques no período.',
                                },
                            ]}
                        />
                    </motion.div>

                    {/* Regras de performance — conformidade por métricas */}
                    {perfComplianceLoading && !perfRuleSummary ? (
                        <motion.div variants={fadeUpVariant}>
                            <KpiStrip columns={4} isLoading items={[]} />
                        </motion.div>
                    ) : perfRuleSummary?.hasRules && perfRuleSummary.total > 0 ? (
                        <>
                            <motion.div variants={fadeUpVariant}>
                                <KpiStrip
                                    columns={5}
                                    items={[
                                        {
                                            label: 'Monitorados',
                                            value: String(perfRuleSummary.total),
                                            sub: 'criativos com regra de anúncio',
                                            tooltip: 'Criativos avaliados pelas regras de performance ativas (nível anúncio).',
                                        },
                                        {
                                            label: 'Dentro da regra',
                                            value: String(perfRuleSummary.approved),
                                            sub: `${Math.round((perfRuleSummary.approved / perfRuleSummary.total) * 100)}%`,
                                            valueClassName: 'text-emerald-600 dark:text-emerald-400',
                                            tooltip: 'Criativos cujas métricas (CTR, CPC, spend, etc.) estão dentro dos limites configurados.',
                                        },
                                        {
                                            label: 'Fora da regra',
                                            value: String(perfRuleSummary.rejected),
                                            sub: `${Math.round((perfRuleSummary.rejected / perfRuleSummary.total) * 100)}%`,
                                            valueClassName: 'text-rose-600 dark:text-rose-400',
                                            tooltip: 'Criativos que violam pelo menos uma regra de performance ativa.',
                                        },
                                        {
                                            label: 'Regras ativas',
                                            value: String(perfRuleSummary.activeRules),
                                            tooltip: 'Regras de automação com escopo anúncio ou global (applies_to: ad / all).',
                                        },
                                        {
                                            label: 'Com violação',
                                            value: String(perfRuleSummary.top_violated_rules.length),
                                            sub: 'tipos de regra',
                                            tooltip: 'Quantidade de regras distintas com pelo menos uma violação detectada.',
                                        },
                                    ]}
                                />
                            </motion.div>

                            <motion.div variants={fadeUpVariant}>
                                <Card variant="elevated">
                                    <CardContent className="pt-5 space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold">Conformidade de performance</p>
                                            {perfRuleSummary.rejected > 0 && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-xs h-8"
                                                    onClick={() => navigate('/criativos')}
                                                >
                                                    Ver criativos
                                                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex gap-0.5 h-3 rounded-full overflow-hidden">
                                            <div
                                                className="bg-emerald-500"
                                                style={{ width: `${(perfRuleSummary.approved / perfRuleSummary.total) * 100}%` }}
                                            />
                                            {perfRuleSummary.rejected > 0 && (
                                                <div
                                                    className="bg-rose-500"
                                                    style={{ width: `${(perfRuleSummary.rejected / perfRuleSummary.total) * 100}%` }}
                                                />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                Dentro da regra {perfRuleSummary.approved}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                                Fora da regra {perfRuleSummary.rejected}
                                            </span>
                                        </div>
                                        {perfRuleSummary.top_violated_rules.length > 0 && (
                                            <div className="pt-3 border-t border-border/20 space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    Regras mais violadas
                                                </p>
                                                {perfRuleSummary.top_violated_rules.map((r, i) => (
                                                    <div key={i} className="flex items-center justify-between text-sm gap-2">
                                                        <span className="truncate">{r.rule_name}</span>
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                                                            {r.count} criativo{r.count > 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </>
                    ) : perfRuleSummary?.hasRules && perfRuleSummary.total === 0 ? (
                        <motion.div variants={fadeUpVariant}>
                            <Card className="flex flex-col items-center justify-center py-10">
                                <Activity className="h-9 w-9 text-muted-foreground/25 mb-3" />
                                <p className="text-sm text-muted-foreground">Regras ativas, mas sem criativos no período</p>
                                <p className="text-xs text-muted-foreground mt-1">Sincronize a conta para avaliar conformidade de performance.</p>
                            </Card>
                        </motion.div>
                    ) : perfRuleSummary && !perfRuleSummary.hasRules ? (
                        <motion.div variants={fadeUpVariant}>
                            <Card className="flex flex-col items-center justify-center py-10">
                                <Activity className="h-9 w-9 text-muted-foreground/25 mb-3" />
                                <p className="text-sm text-muted-foreground">Nenhuma regra de performance no nível anúncio</p>
                                <p className="text-xs text-muted-foreground mt-1 mb-4">
                                    Configure regras com escopo &quot;Anúncio&quot; para monitorar CTR, CPC e outras métricas.
                                </p>
                                <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate('/regras')}>
                                    Ir para Regras
                                </Button>
                            </Card>
                        </motion.div>
                    ) : null}

                    {/* Chart */}
                    {chartData.length > 0 && (
                        <motion.div variants={fadeUpVariant}>
                            <Card variant="elevated">
                                <CardContent className="pt-5">
                                    <p className="text-sm font-semibold mb-1">Investimento diário</p>
                                    <p className="text-xs text-muted-foreground mb-4">Evolução do investimento no período</p>
                                    <div className="h-[200px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={accentColor} stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={45} />
                                                <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), 'Investimento']} />
                                                <Area type="monotone" dataKey="spend" stroke={accentColor} strokeWidth={2} fillOpacity={1} fill="url(#gSpend)" activeDot={{ r: 4, strokeWidth: 0 }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* Funnel — minimal horizontal bars */}
                    <motion.div variants={fadeUpVariant}>
                        <Card variant="elevated">
                            <CardContent className="pt-5 space-y-3">
                                <div>
                                    <p className="text-sm font-semibold">Funil de conversão</p>
                                    <p className="text-xs text-muted-foreground">Eficiência em cada etapa</p>
                                </div>
                                {(() => {
                                    const imp = m.totalImpressions;
                                    const clk = m.totalClicks;
                                    const conv = m.totalConversions;
                                    const ctr = imp > 0 ? (clk / imp * 100) : 0;
                                    const cvr = clk > 0 ? (conv / clk * 100) : 0;
                                    const overall = imp > 0 ? (conv / imp * 100) : 0;
                                    const max = Math.max(imp, 1);
                                    return (
                                        <>
                                            {[
                                                { label: 'Impressões', val: imp, w: 100, color: 'bg-blue-500' },
                                                { label: 'Cliques', val: clk, w: (clk / max) * 100, color: 'bg-ch-orange', rate: `↓ ${ctr.toFixed(2)}% avançaram` },
                                                { label: 'Conversões', val: conv, w: Math.max((conv / max) * 100, 1), color: 'bg-emerald-500', rate: `↓ ${cvr.toFixed(2)}% avançaram` },
                                            ].map((s) => (
                                                <div key={s.label}>
                                                    {s.rate && <p className="text-[11px] text-muted-foreground mb-2 ml-1">{s.rate}</p>}
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-muted-foreground w-20 text-right">{s.label}</span>
                                                        <FunnelBar width={s.w} colorClass={s.color} />
                                                        <span className="text-sm font-semibold tabular-nums w-20">{formatNumber(s.val)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="text-center pt-2 border-t border-border/20">
                                                <p className="text-xs text-muted-foreground">Taxa geral: <span className="font-semibold text-foreground">{overall.toFixed(2)}%</span> das impressões converteram</p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Top 3 Creatives */}
                    {creativeLoading && !creativeData ? (
                        <motion.div variants={fadeUpVariant}>
                            <Card variant="elevated">
                                <CardContent className="pt-5">
                                    <PageSkeleton kpiCount={0} sections={1} />
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : creativeData?.topCreatives?.length > 0 ? (
                        <motion.div variants={fadeUpVariant}>
                            <Card variant="elevated">
                                <CardContent className="pt-5 space-y-2">
                                    <p className="text-sm font-semibold">Criativos campeões</p>
                                    <p className="text-xs text-muted-foreground mb-2">Top 3 por conversões</p>
                                    {creativeData.topCreatives.slice(0, 3).map((c: any, i: number) => (
                                        <div key={c.id} onClick={() => navigate(`/criativos/${c.id}`)}
                                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:ring-1 hover:ring-border/30">
                                            <span className={`text-xs font-bold w-7 h-7 rounded-md flex items-center justify-center ${i === 0 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>
                                                {c.format?.toUpperCase() === 'VIDEO' ? 'VID' : 'IMG'}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{c.name?.replace(/_/g, ' ').replace(/\.[^/.]+$/, '')}</p>
                                                <p className="text-xs text-muted-foreground">{c.conversions || 0} conversões · CTR {(c.ctr || 0).toFixed(1)}%</p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : null}

                    {/* AI Feedback — single clean block */}
                    <motion.div variants={fadeUpVariant}>
                        <Card variant="elevated">
                            <CardContent className="pt-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="h-4 w-4 text-ch-orange" />
                                    <p className="text-sm font-semibold">Feedback do Click Auditor</p>
                                </div>
                                <div className="p-4 rounded-lg bg-muted/40 border-0 ring-1 ring-border/20">
                                    <p className="text-sm leading-relaxed text-foreground/85">
                                        {(() => {
                                            const parts: string[] = [];
                                            if (m.avgCpc > 1.80) parts.push(`O CPC médio (${formatCurrency(m.avgCpc)}) está acima de R$ 1,80. Considere pausar criativos com CPC alto e realocar orçamento.`);
                                            if (m.avgCtr >= 1.5) parts.push('O CTR está saudável.');
                                            else if (m.avgCtr > 0) parts.push('O CTR está abaixo de 1,5%. Revise criativos com baixo engajamento.');
                                            if (m.totalConversions > 0) parts.push('Tendência positiva em volume, mas atenção ao custo por resultado.');
                                            else parts.push('Sem conversões no período. Verifique pixel/eventos.');
                                            return parts.join(' ');
                                        })()}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </>
            )}

            {/* ══════════ BRANDING ══════════ */}
            {module === 'branding' && (
                <>
                    {complianceLoading && !compliance ? (
                        <motion.div variants={fadeUpVariant}>
                            <KpiStrip columns={5} isLoading items={[]} />
                        </motion.div>
                    ) : compliance && compliance.total_checked > 0 ? (
                        <>
                            <motion.div variants={fadeUpVariant}>
                                <KpiStrip
                                    columns={5}
                                    items={[
                                        {
                                            label: 'Analisados',
                                            value: String(compliance.total_checked),
                                            sub: `${compliance.total_checked} totais`,
                                            tooltip: 'Total de criativos que já passaram pela auditoria IA.',
                                            onClick: () => navigate('/criativos'),
                                        },
                                        {
                                            label: 'Conformes',
                                            value: String(compliance.approved),
                                            sub: `${Math.round((compliance.approved / compliance.total_checked) * 100)}%`,
                                            valueClassName: 'text-emerald-600 dark:text-emerald-400',
                                            tooltip: 'Criativos que passaram em todas as regras de branding.',
                                            onClick: () => navigate('/criativos?compliance=approved'),
                                        },
                                        {
                                            label: 'Não conformes',
                                            value: String(compliance.rejected + compliance.warning),
                                            sub: `${Math.round(((compliance.rejected + compliance.warning) / compliance.total_checked) * 100)}%`,
                                            valueClassName: 'text-rose-600 dark:text-rose-400',
                                            tooltip: 'Reprovados + alertas que precisam de revisão.',
                                            onClick: () => navigate('/criativos?compliance=rejected'),
                                        },
                                        {
                                            label: 'Campanhas',
                                            value: String(monitoredCampaignCount),
                                            tooltip: 'Campanhas monitoradas no escopo atual.',
                                            onClick: () => navigate('/campanhas'),
                                        },
                                        {
                                            label: 'Regras ativas',
                                            value: String(activeRulesCount),
                                            tooltip: 'Regras de branding ativas configuradas.',
                                            onClick: () => navigate('/regras'),
                                        },
                                    ]}
                                />
                            </motion.div>

                            {/* Conformidade — visual bar */}
                            <motion.div variants={fadeUpVariant}>
                                <Card
                                    variant="elevated"
                                    className="cursor-pointer transition-colors hover:bg-muted/20"
                                    onClick={() => navigate(
                                        compliance.rejected + compliance.warning > 0
                                            ? '/criativos?compliance=rejected'
                                            : '/criativos',
                                    )}
                                >
                                    <CardContent className="pt-5 space-y-3">
                                        <p className="text-sm font-semibold">Conformidade</p>
                                        <div className="flex gap-0.5 h-3 rounded-full overflow-hidden">
                                            <div className="bg-emerald-500" style={{ width: `${(compliance.approved / compliance.total_checked) * 100}%` }} />
                                            {compliance.warning > 0 && <div className="bg-amber-500" style={{ width: `${(compliance.warning / compliance.total_checked) * 100}%` }} />}
                                            {compliance.rejected > 0 && <div className="bg-rose-500" style={{ width: `${(compliance.rejected / compliance.total_checked) * 100}%` }} />}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Aprovados {compliance.approved}</span>
                                            {compliance.warning > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Alertas {compliance.warning}</span>}
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />Reprovados {compliance.rejected}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>

                            {/* Campaigns + Health side by side */}
                            <div className="grid gap-4 lg:grid-cols-2">
                                {/* Campanhas — conformidade branding (sem métricas financeiras) */}
                                {brandingCampaignHighlights.length > 0 && (
                                    <motion.div variants={fadeUpVariant}>
                                        <Card variant="elevated">
                                            <CardContent className="pt-5 space-y-2">
                                                <p className="text-sm font-semibold mb-2">Campanhas monitoradas</p>
                                                {brandingCampaignHighlights.map((c) => (
                                                    <div key={c.id} onClick={() => navigate(`/campanhas/${c.id}`)}
                                                        className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer border border-transparent hover:ring-1 hover:ring-border/30 transition-colors">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium truncate">{c.name}</p>
                                                        </div>
                                                        <BrandingCounts counts={c.counts} variant="compact" hidePendingWhenZero />
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                )}

                                {/* Health score */}
                                <motion.div variants={fadeUpVariant}>
                                    <Card variant="elevated">
                                        <CardContent className="pt-5">
                                            <p className="text-sm font-semibold mb-4">Saúde da conta</p>
                                            {(() => {
                                                const score = Math.round((compliance.approved / compliance.total_checked) * 100);
                                                const label = score >= 80 ? 'Boa' : score >= 50 ? 'Regular' : 'Crítica';
                                                const color = score >= 80 ? 'border-emerald-500 text-emerald-600' : score >= 50 ? 'border-amber-500 text-amber-600' : 'border-rose-500 text-rose-600';
                                                return (
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-16 h-16 rounded-full border-4 ${color} flex items-center justify-center`}>
                                                            <span className="text-2xl font-semibold">{score}</span>
                                                        </div>
                                                        <div>
                                                            <p className={`text-lg font-bold ${color.split(' ')[1]}`}>{label}</p>
                                                            {compliance.non_compliant_creatives?.length > 0 && (
                                                                <p className="text-xs text-muted-foreground">{compliance.non_compliant_creatives.length} criativos com problemas</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Rules inline */}
                                            {compliance.top_violated_rules?.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-border/20 space-y-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regras</p>
                                                    {compliance.top_violated_rules.map((r: any, i: number) => (
                                                        <div
                                                            key={i}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => navigate('/criativos?compliance=rejected')}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    navigate('/criativos?compliance=rejected');
                                                                }
                                                            }}
                                                            className="flex items-center justify-between text-sm rounded-lg px-2 py-1.5 -mx-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                                        >
                                                            <span className="truncate">{r.rule_name}</span>
                                                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${r.count > 0 ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600'}`}>
                                                                {r.count} violações
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {compliance.non_compliant_creatives?.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-border/20 space-y-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Criativos com problemas</p>
                                                    {compliance.non_compliant_creatives.map((c) => (
                                                        <div
                                                            key={c.creative_id}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => navigate(`/criativos/${c.creative_id}`)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    navigate(`/criativos/${c.creative_id}`);
                                                                }
                                                            }}
                                                            className="flex items-center justify-between text-sm gap-2 rounded-lg px-2 py-1.5 -mx-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                                        >
                                                            <span className="truncate">{c.creative_name}</span>
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </div>
                        </>
                    ) : (
                        <motion.div variants={fadeUpVariant}>
                            <Card className="flex flex-col items-center justify-center py-16 gap-3">
                                <ShieldCheck className="h-10 w-10 text-muted-foreground/20 mb-1" />
                                <p className="text-sm text-muted-foreground">Nenhuma análise de conformidade realizada</p>
                                <p className="text-xs text-muted-foreground">Execute a Análise de Branding para ver conformidade da sua marca.</p>
                                <Button
                                    size="sm"
                                    onClick={startBrandingAnalysis}
                                    disabled={isBrandingAnalysisRunning}
                                    className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                                >
                                    {isBrandingAnalysisRunning ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Sparkles className="h-4 w-4 mr-2" />
                                    )}
                                    Análise de Branding
                                </Button>
                            </Card>
                        </motion.div>
                    )}
                </>
            )}

            <BrandBriefingWizard
                isOpen={wizardOpen}
                onClose={() => setWizardOpen(false)}
                onComplete={onBriefingComplete}
                allowSkip={hadBriefingOnStart}
            />

            <SelectRuleDialog
                isOpen={ruleSelectorOpen}
                onClose={() => setRuleSelectorOpen(false)}
                onConfirm={onRulesSelected}
                title="Quais regras aplicar na Análise de Branding?"
                description="Criativos ativos em campanhas ativas serão verificados contra as regras selecionadas e o briefing de marca."
            />

            <SyncLikeOverlay
                open={brandingOverlayOpen || isBrandingAnalysisRunning}
                progress={brandingOverlayProgress}
                title="Analisando criativos com IA"
                subtitle={
                    brandingOverlayTotal > 0
                        ? `Verificando ${brandingOverlayCurrent} de ${brandingOverlayTotal} criativos em campanhas ativas`
                        : 'Preparando análise de conformidade da marca'
                }
                steps={BRANDING_STEPS}
                currentStepIndex={brandingStepIndex}
                currentStepDetail={brandingStepDetail}
                theme="branding"
                finished={brandingOverlayFinished}
                finishedTitle="Análise de branding concluída"
                footerText="A verificação pode levar alguns minutos dependendo do volume de criativos"
                footerFinishedText="Relatório de conformidade pronto"
            />

            <ComplianceReportOverlay
                open={complianceOverlayOpen}
                onClose={() => setComplianceOverlayOpen(false)}
                items={complianceOverlayItems}
                approvedCount={complianceApprovedCount}
            />
        </motion.div>
    );
}
