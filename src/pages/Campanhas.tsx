import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { conjuntosPath, criativosPath } from '@/lib/campaignNavigation';
import {
    Activity,
    Plus,
    Search,
    Filter,
    ArrowUpDown,
    Check,
    AlertTriangle,
    Clock,
    DollarSign,
    MousePointer,
    Eye,
    Target,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    Zap,
    Sparkles,
    BrainCircuit,
    ChevronRight,
    Settings,
    MoreVertical,
    ShieldCheck,
    CheckSquare,
    Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { useModule } from '@/contexts/ModuleContext';
import { useBrandingCompliance } from '@/hooks/useBrandingCompliance';
import { usePerformanceCompliance } from '@/hooks/usePerformanceCompliance';
import { BrandingCounts } from '@/components/branding/BrandingCounts';
import { SelectRuleDialog } from '@/components/branding/SelectRuleDialog';
import CreativeRuleCheckModal from '@/components/integrations/CreativeRuleCheckModal';
import { SelectAnalysisScopeDialog, type PerformanceAnalysisScope } from '@/components/audits/SelectAnalysisScopeDialog';
import { PerformanceEntityAuditDialog } from '@/components/audits/PerformanceEntityAuditDialog';
import { useEntityAudit } from '@/hooks/useEntityAudit';
import { useBrandingGateBatchFlow } from '@/hooks/useBrandingGateBatchFlow';
import {
    BRANDING_GATE_BATCH_NONE_MSG,
} from '@/lib/brandingPerformanceGate';
import {
    fetchActiveCreativeIds,
    fetchCreativeNamesByIds,
} from '@/lib/fetchBrandingGateStatuses';
import { toast } from 'sonner';
import type { Audit } from '@/hooks/useAudits';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { InfoTip } from '@/components/ui/info-tip';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import {
    fetchCampaignPeriodMetrics,
    metricsFromAggregated,
    metricsFromCampaignRow,
} from '@/lib/listMetrics';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';

const ITEMS_PER_PAGE = 20;

type SortOption = 'recent' | 'spend_desc' | 'spend_asc' | 'conversions_desc' | 'ctr_desc' | 'cpa_asc' | 'impressions_desc';

export default function Campanhas() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { effectiveIds } = useIntegrationFilter();
    const { range: dateRange } = useDateFilter();
    const { module } = useModule();
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);
    const isBranding = module === 'branding';
    const { data: brandingCompliance } = useBrandingCompliance();
    const { data: performanceCompliance } = usePerformanceCompliance();
    const complianceByCampaign = isBranding
        ? brandingCompliance?.byCampaign
        : performanceCompliance?.byCampaign;
    const { t } = useTranslation(['campaigns', 'common']);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState<SortOption>(isBranding ? 'recent' : 'spend_desc');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setSortBy(isBranding ? 'recent' : 'spend_desc');
    }, [isBranding]);

    // C1: branding status filter for performance views (briefing #9). Default: todos.
    // (Briefing pediu 'aprovados', mas isso esconde toda campanha ainda não auditada —
    // ou seja, a tela nasce vazia. Default 'all' evita isso; o time filtra quando quiser.)
    const [complianceStatusFilter, setComplianceStatusFilter] = useState<'approved' | 'all' | 'rejected'>('all');

    // Multi-select — branding (regras) e performance (análise IA em lote)
    const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
    const [isRuleSelectorOpen, setIsRuleSelectorOpen] = useState(false);
    const [isScopeDialogOpen, setIsScopeDialogOpen] = useState(false);
    const [batchQueue, setBatchQueue] = useState<Array<{ id: string; name: string }>>([]);
    const [batchIndex, setBatchIndex] = useState(0);
    const [batchRuleIds, setBatchRuleIds] = useState<string[]>([]);
    const [entityAuditOpen, setEntityAuditOpen] = useState(false);
    const [entityAudit, setEntityAudit] = useState<Audit | null>(null);
    const [entityAuditName, setEntityAuditName] = useState('');
    const [entityAuditCampaignId, setEntityAuditCampaignId] = useState<string | null>(null);
    const [batchBusy, setBatchBusy] = useState(false);
    const [creativeEstimate, setCreativeEstimate] = useState<number | undefined>();
    const [isPerfRuleDialogOpen, setIsPerfRuleDialogOpen] = useState(false);
    const [perfRuleIdsForBatch, setPerfRuleIdsForBatch] = useState<string[]>([]);
    const [pendingEntityAnalysis, setPendingEntityAnalysis] = useState<{
        campaignId: string;
        campaignName: string;
        forceRefresh?: boolean;
    } | null>(null);

    const { runCampaignAudit, runEntityQueue, runCreativesBatch } = useEntityAudit();
    const { runWithBrandingGate, BrandingGateDialog } = useBrandingGateBatchFlow();

    const toggleSelectCampaign = (id: string) => {
        setSelectedCampaignIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const startBatchAnalysis = async (ruleIds: string[]) => {
        if (!user?.company_id || selectedCampaignIds.size === 0) return;
        // Load all creatives across the selected campaigns, in a single query.
        const { data: creatives } = await supabase
            .from('creatives')
            .select('id, name')
            .eq('company_id', user.company_id)
            .in('campaign_id', Array.from(selectedCampaignIds))
            .order('name');
        const queue = (creatives ?? []).map(c => ({ id: c.id, name: c.name || c.id }));
        if (queue.length === 0) return;
        setBatchRuleIds(ruleIds);
        setBatchQueue(queue);
        setBatchIndex(0);
    };

    const closeBatch = () => {
        setBatchQueue([]);
        setBatchIndex(0);
        setBatchRuleIds([]);
    };

    const handleCampaignAiAnalysis = async (
        campaignId: string,
        campaignName: string,
        performanceRuleIds?: string[],
        forceRefresh?: boolean,
    ) => {
        try {
            const result = await runCampaignAudit.mutateAsync({
                campaignId,
                forceRefresh,
                performanceRuleIds,
            });
            setEntityAudit(result.audit);
            setEntityAuditName(campaignName);
            setEntityAuditCampaignId(campaignId);
            setEntityAuditOpen(true);
        } catch {
            /* toast via hook */
        }
    };

    const openPerformanceAnalysisFlow = () => {
        if (selectedCampaignIds.size === 0) return;
        setIsPerfRuleDialogOpen(true);
    };

    const openPerformanceScopeDialog = async () => {
        if (!user?.company_id || selectedCampaignIds.size === 0) return;
        const { count } = await supabase
            .from('creatives')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', user.company_id)
            .ilike('status', 'active')
            .in('campaign_id', Array.from(selectedCampaignIds));
        setCreativeEstimate(count ?? 0);
        setIsScopeDialogOpen(true);
    };

    const runPerformanceBatch = async (scope: PerformanceAnalysisScope) => {
        const ids = Array.from(selectedCampaignIds);
        if (!ids.length || !user?.company_id) return;

        const finishBatch = () => {
            setIsScopeDialogOpen(false);
            setSelectedCampaignIds(new Set());
        };

        const runCreativesWithGate = async () => {
            const creativeIds = await fetchActiveCreativeIds(supabase, user.company_id, {
                campaignIds: ids,
            });
            const nameById = await fetchCreativeNamesByIds(supabase, user.company_id, creativeIds);
            await runWithBrandingGate(
                creativeIds,
                async (approvedIds) => {
                    if (!approvedIds.length) {
                        toast.error(BRANDING_GATE_BATCH_NONE_MSG);
                        return;
                    }
                    setBatchBusy(true);
                    try {
                        await runCreativesBatch.mutateAsync({
                            creativeIds: approvedIds,
                            performanceRuleIds:
                                perfRuleIdsForBatch.length > 0 ? perfRuleIdsForBatch : undefined,
                        });
                        finishBatch();
                    } catch {
                        /* toast via hook */
                    } finally {
                        setBatchBusy(false);
                    }
                },
                nameById,
            );
        };

        if (scope === 'entities') {
            setBatchBusy(true);
            try {
                await runEntityQueue.mutateAsync({
                    ids,
                    level: 'campaign',
                    performanceRuleIds:
                        perfRuleIdsForBatch.length > 0 ? perfRuleIdsForBatch : undefined,
                });
                finishBatch();
            } catch {
                /* toast via hook */
            } finally {
                setBatchBusy(false);
            }
            return;
        }

        setBatchBusy(true);
        try {
            if (scope === 'both') {
                await runEntityQueue.mutateAsync({
                    ids,
                    level: 'campaign',
                    performanceRuleIds:
                        perfRuleIdsForBatch.length > 0 ? perfRuleIdsForBatch : undefined,
                });
            }
            setBatchBusy(false);
            await runCreativesWithGate();
        } catch {
            setBatchBusy(false);
        }
    };

    const {
        data: campaigns,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ['campaigns', user?.company_id, effectiveIds, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!user?.company_id) return [];

            const rows = await fetchAllPaginated<any>(() => {
                let q = supabase
                    .from('campaigns')
                    .select('*')
                    .eq('company_id', user.company_id)
                    .order('created_at', { ascending: false });
                if (effectiveIds.length > 0) q = q.in('integration_id', effectiveIds);
                return q;
            });

            const usePeriodMetrics =
                !dateRange.isAll && !!dateRange.startDate && !!dateRange.endDate;

            const periodByCampaign = usePeriodMetrics
                ? await fetchCampaignPeriodMetrics(
                    rows.map((c: { id: string }) => c.id),
                    dateRange.startDate!,
                    dateRange.endDate!,
                )
                : null;

            return rows.map((campaign: any) => {
                const agg = usePeriodMetrics
                    ? periodByCampaign?.get(campaign.id)
                    : metricsFromCampaignRow(campaign);
                const metrics = metricsFromAggregated(agg);
                return { ...campaign, metrics };
            });
        },
        enabled: !!user?.company_id,
    });

    useEffect(() => {
        if (isError) {
            console.error('[Campanhas] query failed:', error);
            toast.error('Não foi possível carregar as campanhas. Tente novamente.');
        }
    }, [isError, error]);

    const filteredCampaigns = campaigns?.filter(campaign => {
        const matchesSearch = campaign.name.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || campaign.status === statusFilter;
        // C1: in performance views, filter by branding status (briefing #9).
        // Approved = no rejected creatives + at least one approved creative.
        // Rejected = has at least one rejected creative.
        let matchesCompliance = true;
        if (complianceStatusFilter !== 'all') {
            const counts = complianceByCampaign?.get(campaign.id);
            if (complianceStatusFilter === 'approved') {
                matchesCompliance = !!counts && counts.rejected === 0 && counts.approved > 0;
            } else if (complianceStatusFilter === 'rejected') {
                matchesCompliance = !!counts && counts.rejected > 0;
            }
        }
        return matchesSearch && matchesStatus && matchesCompliance;
    });

    // Sort campaigns based on selected option
    const sortedCampaigns = filteredCampaigns?.sort((a, b) => {
        switch (sortBy) {
            case 'recent':
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            case 'spend_desc':
                return (b.metrics?.spend || 0) - (a.metrics?.spend || 0);
            case 'spend_asc':
                return (a.metrics?.spend || 0) - (b.metrics?.spend || 0);
            case 'conversions_desc':
                return (b.metrics?.conversions || 0) - (a.metrics?.conversions || 0);
            case 'ctr_desc':
                return (b.metrics?.ctr || 0) - (a.metrics?.ctr || 0);
            case 'cpa_asc':
                return (a.metrics?.cpa || 0) - (b.metrics?.cpa || 0);
            case 'impressions_desc':
                return (b.metrics?.impressions ?? 0) - (a.metrics?.impressions ?? 0);
            default:
                return 0;
        }
    });

    const totalPages = Math.ceil((sortedCampaigns?.length || 0) / ITEMS_PER_PAGE);
    const paginatedCampaigns = sortedCampaigns?.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Reset to page 1 when filters change
    const handleSearchChange = (value: string) => {
        setSearch(value);
        setCurrentPage(1);
    };

    const handleStatusChange = (status: string) => {
        setStatusFilter(status);
        setCurrentPage(1);
    };

    const handleSortChange = (sort: SortOption) => {
        setSortBy(sort);
        setCurrentPage(1);
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            className="p-4 md:p-6 space-y-6 md:space-y-8 pb-20"
        >
            {/* Header */}
            <motion.div variants={item}>
                <SectionHeader
                    title={t('campaigns:title')}
                    description={`${t('campaigns:subtitle', { count: campaigns?.length || 0 })}${filteredCampaigns && filteredCampaigns.length !== campaigns?.length ? ` • ${t('campaigns:filtered', { count: filteredCampaigns.length })}` : ''}`}
                    actions={
                        <div className="flex items-center gap-3">
                            {!isBranding && <DateRangeFilter />}
                            {!isBranding && (
                                <InfoTip title="Nova campanha" hint="Cria uma campanha do zero pelo assistente guiado (objetivo, conjunto, criativo).">
                                    <Button
                                        variant="outline"
                                        className="h-11 border-border bg-card hover:bg-muted/50 text-foreground font-semibold text-xs px-6 rounded-xl transition-all"
                                        onClick={() => navigate('/campanhas/nova')}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        {t('campaigns:newCampaign')}
                                    </Button>
                                </InfoTip>
                            )}
                        </div>
                    }
                />
            </motion.div>

            {/* Filters */}
            <motion.div
                variants={item}
                className="flex flex-col sm:flex-row gap-4 bg-card p-2 rounded-2xl border border-border shadow-sm"
            >
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder={t('campaigns:searchPlaceholder')}
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-11 h-12 bg-transparent border-none text-foreground placeholder:text-muted-foreground/50 font-medium focus:ring-0 text-sm"
                    />
                </div>
                <div className="flex gap-2 p-1">
                    {['ALL', 'active', 'paused'].map((status) => (
                        <Button
                            key={status}
                            variant={statusFilter === status ? 'secondary' : 'ghost'}
                            onClick={() => handleStatusChange(status)}
                            className={`h-10 px-3 sm:px-6 rounded-xl font-medium text-xs transition-all ${statusFilter === status
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                        >
                            {status === 'ALL' ? t('campaigns:statusFilter.all') : status === 'active' ? t('campaigns:statusFilter.active') : t('campaigns:statusFilter.paused')}
                        </Button>
                    ))}
                </div>
                <DropdownMenu>
                    <InfoTip
                        title={isBranding ? 'Filtro de branding' : 'Filtro de performance'}
                        hint={
                            isBranding
                                ? "Filtra campanhas pela conformidade de branding dos criativos."
                                : "Filtra campanhas por criativos fora das regras de performance (métricas)."
                        }
                    >
                          <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-10 px-4 rounded-xl border-border bg-card hover:bg-muted/50 text-foreground font-medium text-xs gap-2"
                            >
                                {isBranding ? <ShieldCheck className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                                {complianceStatusFilter === 'approved'
                                    ? (isBranding ? 'Branding: Aprovados' : 'Performance: OK')
                                    : complianceStatusFilter === 'rejected'
                                        ? (isBranding ? 'Branding: Reprovados' : 'Performance: Fora da regra')
                                        : (isBranding ? 'Branding: Todos' : 'Performance: Todos')}
                            </Button>
                          </DropdownMenuTrigger>
                        </InfoTip>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                {isBranding ? 'Status de Branding' : 'Status de Performance'}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setComplianceStatusFilter('approved')} className={complianceStatusFilter === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : ''}>
                                {isBranding ? 'Apenas aprovados' : 'Dentro da regra'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setComplianceStatusFilter('rejected')} className={complianceStatusFilter === 'rejected' ? 'bg-red-500/10 text-red-500' : ''}>
                                {isBranding ? 'Apenas reprovados' : 'Fora da regra'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setComplianceStatusFilter('all')} className={complianceStatusFilter === 'all' ? 'bg-primary/10 text-primary' : ''}>
                                Todos (padrão)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                {!isBranding && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="h-10 px-4 rounded-xl border-border bg-card hover:bg-muted/50 text-foreground font-medium text-xs gap-2"
                        >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            {t('campaigns:sort.label')}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('campaigns:sort.sortBy')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => handleSortChange('recent')}
                            className={`cursor-pointer ${sortBy === 'recent' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <Clock className="w-4 h-4 mr-2" />
                            {t('campaigns:sort.recent')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('campaigns:sort.performance')}</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('spend_desc')}
                            className={`cursor-pointer ${sortBy === 'spend_desc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <DollarSign className="w-4 h-4 mr-2" />
                            {t('campaigns:sort.highestSpend')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('spend_asc')}
                            className={`cursor-pointer ${sortBy === 'spend_asc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <DollarSign className="w-4 h-4 mr-2" />
                            {t('campaigns:sort.lowestSpend')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('impressions_desc')}
                            className={`cursor-pointer ${sortBy === 'impressions_desc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <Eye className="w-4 h-4 mr-2" />
                            {t('campaigns:sort.highestImpressions')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('conversions_desc')}
                            className={`cursor-pointer ${sortBy === 'conversions_desc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <Target className="w-4 h-4 mr-2" />
                            {t('campaigns:sort.mostConversions')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('ctr_desc')}
                            className={`cursor-pointer ${sortBy === 'ctr_desc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            {t('campaigns:sort.bestCTR')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('cpa_asc')}
                            className={`cursor-pointer ${sortBy === 'cpa_asc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <BarChart3 className="w-4 h-4 mr-2" />
                            {t('campaigns:sort.lowestCPA')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                )}
            </motion.div>

            {/* Branding bulk-action bar (B1) */}
            {isBranding && selectedCampaignIds.size > 0 && (
                <motion.div
                    variants={item}
                    className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-ch-orange/30 bg-ch-orange/5"
                >
                    <div className="flex items-center gap-2 text-sm">
                        <ShieldCheck className="w-4 h-4 text-ch-orange" />
                        <span className="font-semibold text-foreground">
                            {selectedCampaignIds.size} campanha{selectedCampaignIds.size !== 1 ? 's' : ''} selecionada{selectedCampaignIds.size !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCampaignIds(new Set())}
                            className="h-9 text-xs"
                        >
                            Limpar
                        </Button>
                        <InfoTip title="Analisar em lote" hint="Roda a auditoria de branding da IA nas campanhas selecionadas de uma vez. Você escolhe quais regras aplicar antes.">
                            <Button
                                size="sm"
                                onClick={() => setIsRuleSelectorOpen(true)}
                                className="h-9 bg-ch-orange text-black font-bold text-xs"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                                Analisar em lote
                            </Button>
                        </InfoTip>
                    </div>
                </motion.div>
            )}

            {/* Performance bulk-action bar */}
            {!isBranding && selectedCampaignIds.size > 0 && (
                <motion.div
                    variants={item}
                    className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-primary/30 bg-primary/5"
                >
                    <div className="flex items-center gap-2 text-sm">
                        <BrainCircuit className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-foreground">
                            {selectedCampaignIds.size} campanha{selectedCampaignIds.size !== 1 ? 's' : ''} selecionada{selectedCampaignIds.size !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCampaignIds(new Set())}
                            className="h-9 text-xs"
                        >
                            Limpar
                        </Button>
                        <InfoTip title="Analisar em lote" hint="Auditoria de performance nas campanhas selecionadas e/ou nos criativos ativos filhos.">
                            <Button
                                size="sm"
                                onClick={() => void openPerformanceAnalysisFlow()}
                                disabled={batchBusy}
                                className="h-9 font-bold text-xs"
                            >
                                <BrainCircuit className="w-3.5 h-3.5 mr-1.5" />
                                Analisar em lote
                            </Button>
                        </InfoTip>
                    </div>
                </motion.div>
            )}

            {/* Campaign Grid */}
            <div className="grid gap-4">
                <AnimatePresence>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-32 space-y-4">
                            <div className="relative">
                                <Activity className="w-12 h-12 text-primary animate-pulse opacity-50" />
                                <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full w-12 h-12 animate-spin" />
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">{t('common:loadingData')}</span>
                        </div>
                    ) : isError ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-24 rounded-[2.5rem] border border-destructive/30 bg-destructive/5"
                        >
                            <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-foreground">Erro ao carregar campanhas</h3>
                            <p className="text-muted-foreground text-xs mt-2 mb-4">Verifique sua conexão e tente novamente.</p>
                            <Button variant="outline" size="sm" onClick={() => refetch()}>
                                Tentar novamente
                            </Button>
                        </motion.div>
                    ) : filteredCampaigns?.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-24 rounded-[2.5rem] border border-border bg-muted/50"
                        >
                            <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Search className="w-8 h-8 text-muted-foreground opacity-50" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground uppercase tracking-tight">{t('campaigns:empty.title')}</h3>
                            <p className="text-muted-foreground text-xs uppercase tracking-wide mt-2">{t('campaigns:empty.subtitle')}</p>
                        </motion.div>
                    ) : (
                        paginatedCampaigns?.map((campaign) => {
                            const isSelected = selectedCampaignIds.has(campaign.id);
                            return (
                            <motion.div
                                key={campaign.id}
                                layout
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                onClick={() => navigate(conjuntosPath(campaign.id))}
                                className={`p-6 rounded-2xl border bg-card hover-lift transition-all cursor-pointer group relative overflow-hidden shadow-sm active:scale-[0.99] ${
                                    isSelected
                                        ? isBranding
                                            ? 'border-ch-orange/40 ring-1 ring-ch-orange/30'
                                            : 'border-primary/40 ring-1 ring-primary/30'
                                        : 'border-border hover:border-primary/20'
                                }`}
                            >
                                {/* Multi-select checkbox (branding + performance batch) */}
                                {(isBranding || !isBranding) && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleSelectCampaign(campaign.id); }}
                                        className="absolute top-4 left-4 z-20 p-1 rounded-md hover:bg-muted/80 transition-colors"
                                        title={isSelected ? 'Remover seleção' : 'Selecionar para análise em lote'}
                                    >
                                        {isSelected
                                            ? <CheckSquare className={`w-5 h-5 ${isBranding ? 'text-ch-orange' : 'text-primary'}`} />
                                            : <Square className="w-5 h-5 text-muted-foreground" />}
                                    </button>
                                )}

                                <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_48px] items-center gap-6 xl:gap-8 relative z-10 min-w-0">
                                    <div className="flex items-start gap-5 min-w-0">
                                        <div className={`p-4 rounded-2xl transition-all duration-500 ${campaign.status === 'active'
                                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500'
                                            : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                                            }`}>
                                            {campaign.status === 'active' ? <Activity className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] font-semibold border-0 py-0.5 px-2.5 rounded-md ${campaign.status === 'active'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500'
                                                        : 'bg-muted text-muted-foreground'
                                                        }`}
                                                >
                                                    {campaign.status === 'active' ? t('campaigns:status.active') : campaign.status === 'paused' ? t('campaigns:status.paused') : campaign.status}
                                                </Badge>
                                                {(() => {
                                                    const counts = complianceByCampaign?.get(campaign.id);
                                                    if (!counts || counts.total_creatives === 0) return null;
                                                    const isRejected = counts.rejected > 0;
                                                    const isApproved = counts.rejected === 0 && counts.approved > 0;
                                                    const ComplianceIcon = isBranding ? ShieldCheck : Activity;
                                                    const prefix = isBranding ? 'Branding' : 'Performance';
                                                    return (
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] font-semibold border py-0.5 px-2 rounded-md inline-flex items-center gap-1 ${
                                                                isRejected ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                                isApproved ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                                'bg-muted text-muted-foreground border-border'
                                                            }`}
                                                            title={`${prefix}: ${counts.approved} ok, ${counts.rejected} fora da regra, ${counts.not_checked} sem regra`}
                                                        >
                                                            <ComplianceIcon className="w-2.5 h-2.5" />
                                                            {isRejected
                                                                ? `${counts.rejected} fora da regra`
                                                                : isApproved
                                                                    ? (isBranding ? 'Aprovado' : 'Dentro da regra')
                                                                    : 'Pendente'}
                                                        </Badge>
                                                    );
                                                })()}
                                                <span className="text-[10px] font-medium text-muted-foreground/70 font-mono">ID: {campaign.id.slice(0, 8)}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors mb-2">
                                                {campaign.name}
                                            </h3>
                                            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                                                <div className="flex items-center gap-1.5">
                                                    <Target className="w-3.5 h-3.5 text-primary" />
                                                    {campaign.objective}
                                                </div>
                                                {!isBranding && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-border" />
                                                        <div className="flex items-center gap-1.5">
                                                            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                                                            {formatCurrency(Number(campaign.daily_budget))} {t('campaigns:metrics.perDay')}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Metrics — branding shows compliance only, performance shows financial KPIs */}
                                    {isBranding ? (
                                        <div className="flex flex-col items-end gap-1.5">
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Branding</p>
                                            <BrandingCounts counts={brandingCompliance?.byCampaign.get(campaign.id)} />
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-0">
                                            {[
                                                { label: t('campaigns:metrics.spend'), icon: <DollarSign className="w-3 h-3 text-emerald-500" />, value: formatCurrency(Number(campaign.metrics?.spend || 0)), always: true },
                                                { label: t('campaigns:metrics.impressions'), icon: <Eye className="w-3 h-3 text-blue-500" />, value: formatNumber(campaign.metrics?.impressions || 0), always: false },
                                                { label: t('campaigns:metrics.clicks'), icon: <MousePointer className="w-3 h-3 text-purple-500" />, value: formatNumber(campaign.metrics?.clicks || 0), always: true },
                                                { label: t('campaigns:metrics.conversions'), icon: <Target className="w-3 h-3 text-ch-orange" />, value: String(campaign.metrics?.conversions || 0), always: true },
                                                { label: t('campaigns:metrics.ctr'), icon: <TrendingUp className="w-3 h-3 text-indigo-500" />, value: campaign.metrics?.ctr ? `${campaign.metrics.ctr.toFixed(2)}%` : '0.00%', always: false },
                                                { label: t('campaigns:metrics.cpa'), icon: <BarChart3 className="w-3 h-3 text-amber-500" />, value: campaign.metrics?.conversions && campaign.metrics.conversions > 0 ? formatCurrency(campaign.metrics.cpa) : 'N/A', always: false },
                                            ].map((metric) => (
                                                <div key={metric.label} className={`flex-none w-[110px] lg:w-[130px] space-y-1 text-right ${!metric.always ? 'hidden sm:block' : ''}`}>
                                                    <p className="text-[10px] font-semibold text-muted-foreground flex items-center justify-end gap-1.5">
                                                        {metric.icon} {metric.label}
                                                    </p>
                                                    <p className="text-base lg:text-lg font-bold text-foreground tabular-nums tracking-tight">
                                                        {metric.value}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Action Arrow */}
                                    <div className="hidden lg:flex items-center justify-center w-12 h-12 rounded-full border border-border bg-card group-hover:bg-primary group-hover:border-primary transition-all duration-300 transform group-hover:-rotate-45">
                                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
                                    </div>
                                </div>

                                {/* AI Insight Snippet — performance only */}
                                {!isBranding && campaign.status === 'active' && (
                                    <div className="mt-6 pt-5 border-t border-border flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-primary shrink-0">
                                                <Sparkles className="w-3.5 h-3.5" />
                                                {t('campaigns:insight')}
                                            </div>
                                            <p className="text-xs text-muted-foreground font-medium line-clamp-1">
                                                {t('campaigns:insightText')}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="shrink-0 h-8 text-xs font-semibold rounded-lg border-primary/30 hover:bg-primary/10 hover:text-primary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPendingEntityAnalysis({
                                                    campaignId: campaign.id,
                                                    campaignName: campaign.name,
                                                });
                                            }}
                                            disabled={runCampaignAudit.isPending}
                                        >
                                            <BrainCircuit className="w-3.5 h-3.5 mr-1.5" />
                                            {t('campaigns:aiAnalysisButton')}
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>

            {/* Pagination */}
            {filteredCampaigns && filteredCampaigns.length > ITEMS_PER_PAGE && (
                <motion.div
                    variants={item}
                    className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border"
                >
                    <div className="text-sm text-muted-foreground">
                        {t('campaigns:pagination.showing')} <span className="font-bold text-foreground">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> {t('campaigns:pagination.to')}{' '}
                        <span className="font-bold text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredCampaigns.length)}</span> {t('campaigns:pagination.of')}{' '}
                        <span className="font-bold text-foreground">{filteredCampaigns.length}</span> {t('campaigns:pagination.campaigns')}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="h-9 px-4 rounded-xl border-border hover:bg-muted/50"
                        >
                            {t('campaigns:pagination.previous')}
                        </Button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(page => {
                                    // Show first page, last page, current page, and pages around current
                                    if (page === 1 || page === totalPages) return true;
                                    if (Math.abs(page - currentPage) <= 1) return true;
                                    return false;
                                })
                                .map((page, index, array) => {
                                    // Add ellipsis between non-consecutive pages
                                    const prevPage = array[index - 1];
                                    const showEllipsis = prevPage && page - prevPage > 1;
                                    return (
                                        <div key={page} className="flex items-center gap-1">
                                            {showEllipsis && (
                                                <span className="text-muted-foreground px-2">...</span>
                                            )}
                                            <Button
                                                variant={currentPage === page ? 'default' : 'ghost'}
                                                size="sm"
                                                onClick={() => setCurrentPage(page)}
                                                className={`h-9 w-9 p-0 rounded-xl ${currentPage === page
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                                    }`}
                                            >
                                                {page}
                                            </Button>
                                        </div>
                                    );
                                })}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="h-9 px-4 rounded-xl border-border hover:bg-muted/50"
                        >
                            {t('campaigns:pagination.next')}
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* B1: rule selector + queued check modal for branding bulk analysis */}
            <SelectRuleDialog
                isOpen={isRuleSelectorOpen}
                onClose={() => setIsRuleSelectorOpen(false)}
                onConfirm={(ids) => { void startBatchAnalysis(ids); }}
                title={`Analisar ${selectedCampaignIds.size} campanha${selectedCampaignIds.size !== 1 ? 's' : ''}`}
                description="Selecione as regras a aplicar nos criativos das campanhas escolhidas."
            />
            {batchQueue.length > 0 && (
                <CreativeRuleCheckModal
                    isOpen={true}
                    onClose={closeBatch}
                    creativeId={batchQueue[batchIndex].id}
                    creativeName={batchQueue[batchIndex].name}
                    ruleIds={batchRuleIds}
                    queueIndex={batchQueue.length > 1 ? batchIndex : undefined}
                    queueTotal={batchQueue.length > 1 ? batchQueue.length : undefined}
                    onPrev={batchQueue.length > 1 && batchIndex > 0 ? () => setBatchIndex(i => i - 1) : undefined}
                    onNext={batchQueue.length > 1 && batchIndex < batchQueue.length - 1 ? () => setBatchIndex(i => i + 1) : undefined}
                />
            )}

            <SelectRuleDialog
                isOpen={isPerfRuleDialogOpen}
                onClose={() => setIsPerfRuleDialogOpen(false)}
                onConfirm={(ids) => {
                    setPerfRuleIdsForBatch(ids);
                    setIsPerfRuleDialogOpen(false);
                    void openPerformanceScopeDialog();
                }}
                variant="performance"
                title={`Analisar ${selectedCampaignIds.size} campanha${selectedCampaignIds.size !== 1 ? 's' : ''}`}
                description="Selecione as regras de performance a aplicar na análise em lote."
            />

            <SelectRuleDialog
                isOpen={!!pendingEntityAnalysis}
                onClose={() => setPendingEntityAnalysis(null)}
                onConfirm={(ids) => {
                    if (!pendingEntityAnalysis) return;
                    const { campaignId, campaignName, forceRefresh } = pendingEntityAnalysis;
                    setPendingEntityAnalysis(null);
                    void handleCampaignAiAnalysis(campaignId, campaignName, ids, forceRefresh);
                }}
                variant="performance"
                title={
                    pendingEntityAnalysis
                        ? `Quais regras aplicar em "${pendingEntityAnalysis.campaignName}"?`
                        : undefined
                }
            />

            <SelectAnalysisScopeDialog
                open={isScopeDialogOpen}
                onOpenChange={setIsScopeDialogOpen}
                entityLabel="campanha"
                entityCount={selectedCampaignIds.size}
                creativeEstimate={creativeEstimate}
                onConfirm={(scope) => void runPerformanceBatch(scope)}
                isLoading={batchBusy}
            />

            <PerformanceEntityAuditDialog
                open={entityAuditOpen}
                onOpenChange={setEntityAuditOpen}
                audit={entityAudit}
                entityName={entityAuditName}
                entityLevel="campaign"
                viewCreativesHref={entityAuditCampaignId ? criativosPath({ campaignId: entityAuditCampaignId }) : undefined}
                onReanalyze={entityAuditCampaignId ? () => {
                    setPendingEntityAnalysis({
                        campaignId: entityAuditCampaignId,
                        campaignName: entityAuditName,
                        forceRefresh: true,
                    });
                } : undefined}
                isReanalyzing={runCampaignAudit.isPending}
            />

            {BrandingGateDialog}
        </motion.div >
    );
}
