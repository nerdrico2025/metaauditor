import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
    Activity,
    Plus,
    Search,
    Clock,
    DollarSign,
    MousePointer,
    Eye,
    Target,
    BarChart3,
    TrendingUp,
    Zap,
    Sparkles,
    ChevronRight,
    Layers,
    ArrowUpDown,
    ShieldCheck,
    CheckSquare,
    Square,
    BrainCircuit,
    X,
    AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
import type { Audit } from '@/hooks/useAudits';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { InfoTip } from '@/components/ui/info-tip';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { inlineMetricsGrid } from '@/lib/responsiveGrids';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { fetchAdSetPeriodMetrics } from '@/lib/listMetrics';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';
import { useCampaign } from '@/hooks/useCampaigns';
import { useTranslation } from 'react-i18next';
import {
    criativosPath,
} from '@/lib/campaignNavigation';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const ITEMS_PER_PAGE = 20;

type SortOption = 'recent' | 'spend_desc' | 'spend_asc' | 'impressions_desc' | 'conversions_desc' | 'ctr_desc';

export default function Conjuntos() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const campaignId = searchParams.get('campaignId') || undefined;
    const { t } = useTranslation('campaigns');
    const { data: filterCampaign } = useCampaign(campaignId ?? '');
    const { user } = useAuth();
    const { effectiveIds } = useIntegrationFilter();
    const { range: dateRange } = useDateFilter();
    const { module } = useModule();
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);
    const isBranding = module === 'branding';
    const { data: brandingCompliance } = useBrandingCompliance();
    const { data: performanceCompliance } = usePerformanceCompliance();
    const complianceByAdSet = isBranding
        ? brandingCompliance?.byAdSet
        : performanceCompliance?.byAdSet;
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState<SortOption>('spend_desc');
    const [currentPage, setCurrentPage] = useState(1);

    // C1: branding status filter for performance views.
    // Default 'all' para não esconder conjuntos ainda não auditados (senão a tela nasce vazia).
    const [complianceStatusFilter, setComplianceStatusFilter] = useState<'approved' | 'all' | 'rejected'>('all');

    // Multi-select (B1)
    const [selectedAdSetIds, setSelectedAdSetIds] = useState<Set<string>>(new Set());
    const [isRuleSelectorOpen, setIsRuleSelectorOpen] = useState(false);
    const [batchQueue, setBatchQueue] = useState<Array<{ id: string; name: string }>>([]);
    const [batchIndex, setBatchIndex] = useState(0);
    const [batchRuleIds, setBatchRuleIds] = useState<string[]>([]);
    const [isScopeDialogOpen, setIsScopeDialogOpen] = useState(false);
    const [entityAuditOpen, setEntityAuditOpen] = useState(false);
    const [entityAudit, setEntityAudit] = useState<Audit | null>(null);
    const [entityAuditName, setEntityAuditName] = useState('');
    const [entityAuditAdSetId, setEntityAuditAdSetId] = useState<string | null>(null);
    const [entityAuditCampaignId, setEntityAuditCampaignId] = useState<string | null>(null);
    const [batchBusy, setBatchBusy] = useState(false);
    const [creativeEstimate, setCreativeEstimate] = useState<number | undefined>();

    const { runAdSetAudit, runEntityQueue, runCreativesBatch } = useEntityAudit();

    const toggleSelectAdSet = (id: string) => {
        setSelectedAdSetIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const startBatchAnalysis = async (ruleIds: string[]) => {
        if (!user?.company_id || selectedAdSetIds.size === 0) return;
        const { data: creatives } = await supabase
            .from('creatives')
            .select('id, name')
            .eq('company_id', user.company_id)
            .in('ad_set_id', Array.from(selectedAdSetIds))
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

    const handleAdSetAiAnalysis = async (adSetId: string, adSetName: string, adSetCampaignId: string) => {
        try {
            const result = await runAdSetAudit.mutateAsync({ adSetId });
            setEntityAudit(result.audit);
            setEntityAuditName(adSetName);
            setEntityAuditAdSetId(adSetId);
            setEntityAuditCampaignId(adSetCampaignId);
            setEntityAuditOpen(true);
        } catch {
            /* toast via hook */
        }
    };

    const openPerformanceScopeDialog = async () => {
        if (!user?.company_id || selectedAdSetIds.size === 0) return;
        const { count } = await supabase
            .from('creatives')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', user.company_id)
            .ilike('status', 'active')
            .in('ad_set_id', Array.from(selectedAdSetIds));
        setCreativeEstimate(count ?? 0);
        setIsScopeDialogOpen(true);
    };

    const runPerformanceBatch = async (scope: PerformanceAnalysisScope) => {
        const ids = Array.from(selectedAdSetIds);
        if (!ids.length) return;
        setBatchBusy(true);
        try {
            if (scope === 'entities' || scope === 'both') {
                await runEntityQueue.mutateAsync({ ids, level: 'ad_set' });
            }
            if (scope === 'creatives' || scope === 'both') {
                for (const adSetId of ids) {
                    await runCreativesBatch.mutateAsync({ adSetId });
                }
            }
            setIsScopeDialogOpen(false);
            setSelectedAdSetIds(new Set());
        } catch {
            /* toast via hook */
        } finally {
            setBatchBusy(false);
        }
    };

    const {
        data: adSets,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ['ad_sets', user?.company_id, effectiveIds, dateRange.startDate, dateRange.endDate, campaignId],
        queryFn: async () => {
            if (!user?.company_id) return [];

            const rows = await fetchAllPaginated<any>(() => {
                let q = (supabase as any)
                    .from('ad_sets')
                    .select('*, campaigns!inner(company_id, name, integration_id)')
                    .eq('campaigns.company_id', user.company_id)
                    .order('created_at', { ascending: false });
                if (effectiveIds.length > 0) {
                    q = q.in('campaigns.integration_id', effectiveIds);
                }
                if (campaignId) {
                    q = q.eq('campaign_id', campaignId);
                }
                return q;
            });

            const usePeriodMetrics =
                !dateRange.isAll && !!dateRange.startDate && !!dateRange.endDate;

            const adSetIds = rows.map((a: { id: string }) => a.id);
            const metricsByAdSet = await fetchAdSetPeriodMetrics(
                adSetIds,
                usePeriodMetrics ? dateRange.startDate! : undefined,
                usePeriodMetrics ? dateRange.endDate! : undefined,
            );

            return rows.map((adSet: any) => ({
                ...adSet,
                aggregated_metrics: metricsByAdSet.get(adSet.id) ?? {
                    spend: 0,
                    conversions: 0,
                    impressions: 0,
                    clicks: 0,
                    reach: 0,
                    ctr: 0,
                    cpc: 0,
                    cpm: 0,
                    cpa: 0,
                    frequency: 0,
                },
            }));
        },
        enabled: !!user?.company_id,
    });

    useEffect(() => {
        if (isError) {
            console.error('[Conjuntos] query failed:', error);
            toast.error('Não foi possível carregar os conjuntos. Tente novamente.');
        }
    }, [isError, error]);

    const filteredAdSets = adSets?.filter((adSet: any) => {
        const matchesSearch = adSet.name.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || adSet.status === statusFilter;
        const matchesCampaign = !campaignId || adSet.campaign_id === campaignId;
        let matchesCompliance = true;
        if (complianceStatusFilter !== 'all') {
            const counts = complianceByAdSet?.get(adSet.id);
            if (complianceStatusFilter === 'approved') {
                matchesCompliance = !!counts && counts.rejected === 0 && counts.approved > 0;
            } else if (complianceStatusFilter === 'rejected') {
                matchesCompliance = !!counts && counts.rejected > 0;
            }
        }
        return matchesSearch && matchesStatus && matchesCampaign && matchesCompliance;
    });

    // Sort ad sets based on selected option
    const sortedAdSets = filteredAdSets?.sort((a: any, b: any) => {
        switch (sortBy) {
            case 'recent':
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            case 'spend_desc':
                return (b.aggregated_metrics?.spend || 0) - (a.aggregated_metrics?.spend || 0);
            case 'spend_asc':
                return (a.aggregated_metrics?.spend || 0) - (b.aggregated_metrics?.spend || 0);
            case 'impressions_desc':
                return (b.aggregated_metrics?.impressions || 0) - (a.aggregated_metrics?.impressions || 0);
            case 'conversions_desc':
                return (b.aggregated_metrics?.conversions || 0) - (a.aggregated_metrics?.conversions || 0);
            case 'ctr_desc':
                return (b.aggregated_metrics?.ctr || 0) - (a.aggregated_metrics?.ctr || 0);
            default:
                return 0;
        }
    });

    const totalPages = Math.ceil((sortedAdSets?.length || 0) / ITEMS_PER_PAGE);
    const paginatedAdSets = sortedAdSets?.slice(
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
            className="p-6 space-y-8 pb-20"
        >
            {/* Header */}
            <motion.div variants={item}>
                <SectionHeader
                    title="Conjuntos de Anúncios"
                    description={`Gerenciamento tático de ${adSets?.length || 0} segmentos de audiência${filteredAdSets && filteredAdSets.length !== adSets?.length ? ` • ${filteredAdSets.length} filtrados` : ''}`}
                    actions={
                        <div className="flex items-center gap-3">
                            {!isBranding && <DateRangeFilter />}
                            {!isBranding && (
                                <Button
                                    variant="outline"
                                    className="h-11 border-border bg-card hover:bg-muted/50 text-foreground font-semibold text-xs px-6 rounded-xl transition-all"
                                    onClick={() => { }}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Novo Conjunto
                                </Button>
                            )}
                        </div>
                    }
                />
            </motion.div>

            {campaignId && (
                <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link to="/campanhas">{t('breadcrumb.campaigns')}</Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>
                                    {filterCampaign?.name ?? adSets?.[0]?.campaigns?.name ?? '...'}
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>{t('breadcrumb.adSets')}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-xs" asChild>
                            <Link to="/campanhas">{t('breadcrumb.allCampaigns')}</Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs" asChild>
                            <Link to="/conjuntos">
                                <X className="w-3 h-3 mr-1" />
                                {t('breadcrumb.clearFilter')}
                            </Link>
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* Filters */}
            <motion.div
                variants={item}
                className="flex flex-col sm:flex-row gap-4 bg-card p-2 rounded-2xl border border-border shadow-sm"
            >
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar conjunto por nome ou ID..."
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
                            className={`h-10 px-6 rounded-xl font-medium text-xs transition-all ${statusFilter === status
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                        >
                            {status === 'ALL' ? 'Todos' : status === 'active' ? 'Ativos' : 'Pausados'}
                        </Button>
                    ))}
                </div>
                <DropdownMenu>
                    <InfoTip
                        title={isBranding ? 'Filtro de branding' : 'Filtro de performance'}
                        hint={
                            isBranding
                                ? 'Filtra conjuntos pela conformidade de branding dos criativos.'
                                : 'Filtra conjuntos por criativos fora das regras de performance.'
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
                            Ordenar
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ordenar por</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => handleSortChange('recent')}
                            className={`cursor-pointer ${sortBy === 'recent' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <Clock className="w-4 h-4 mr-2" />
                            Mais Recentes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Performance</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('spend_desc')}
                            className={`cursor-pointer ${sortBy === 'spend_desc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Maior Gasto
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('spend_asc')}
                            className={`cursor-pointer ${sortBy === 'spend_asc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Menor Gasto
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('impressions_desc')}
                            className={`cursor-pointer ${sortBy === 'impressions_desc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <Eye className="w-4 h-4 mr-2" />
                            Maior Impressão
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('conversions_desc')}
                            className={`cursor-pointer ${sortBy === 'conversions_desc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <Target className="w-4 h-4 mr-2" />
                            Mais Resultados
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleSortChange('ctr_desc')}
                            className={`cursor-pointer ${sortBy === 'ctr_desc' ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                        >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Melhor CTR
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                )}
            </motion.div>

            {/* Branding bulk-action bar */}
            {isBranding && selectedAdSetIds.size > 0 && (
                <motion.div
                    variants={item}
                    className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-ch-orange/30 bg-ch-orange/5"
                >
                    <div className="flex items-center gap-2 text-sm">
                        <ShieldCheck className="w-4 h-4 text-ch-orange" />
                        <span className="font-semibold text-foreground">
                            {selectedAdSetIds.size} conjunto{selectedAdSetIds.size !== 1 ? 's' : ''} selecionado{selectedAdSetIds.size !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedAdSetIds(new Set())} className="h-9 text-xs">Limpar</Button>
                        <InfoTip title="Analisar em lote" hint="Roda a auditoria de branding da IA nos conjuntos selecionados de uma vez. Você escolhe quais regras aplicar antes.">
                            <Button size="sm" onClick={() => setIsRuleSelectorOpen(true)} className="h-9 bg-ch-orange text-black font-bold text-xs">
                                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                                Analisar em lote
                            </Button>
                        </InfoTip>
                    </div>
                </motion.div>
            )}

            {/* Performance bulk-action bar */}
            {!isBranding && selectedAdSetIds.size > 0 && (
                <motion.div
                    variants={item}
                    className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-primary/30 bg-primary/5"
                >
                    <div className="flex items-center gap-2 text-sm">
                        <BrainCircuit className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-foreground">
                            {selectedAdSetIds.size} conjunto{selectedAdSetIds.size !== 1 ? 's' : ''} selecionado{selectedAdSetIds.size !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedAdSetIds(new Set())} className="h-9 text-xs">Limpar</Button>
                        <InfoTip title="Analisar em lote" hint="Auditoria de performance nos conjuntos selecionados e/ou nos criativos ativos filhos.">
                            <Button size="sm" onClick={() => void openPerformanceScopeDialog()} disabled={batchBusy} className="h-9 font-bold text-xs">
                                <BrainCircuit className="w-3.5 h-3.5 mr-1.5" />
                                Analisar em lote
                            </Button>
                        </InfoTip>
                    </div>
                </motion.div>
            )}

            {/* AdSet Grid */}
            <div className="grid gap-4">
                <AnimatePresence>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-32 space-y-4">
                            <div className="relative">
                                <Activity className="w-12 h-12 text-primary animate-pulse opacity-50" />
                                <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full w-12 h-12 animate-spin" />
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Carregando Dados...</span>
                        </div>
                    ) : isError ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-24 rounded-[2.5rem] border border-destructive/30 bg-destructive/5"
                        >
                            <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-foreground">Erro ao carregar conjuntos</h3>
                            <p className="text-muted-foreground text-xs mt-2 mb-4">Verifique sua conexão e tente novamente.</p>
                            <Button variant="outline" size="sm" onClick={() => refetch()}>
                                Tentar novamente
                            </Button>
                        </motion.div>
                    ) : filteredAdSets?.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-24 rounded-[2.5rem] border border-border bg-muted/50"
                        >
                            <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Search className="w-8 h-8 text-muted-foreground opacity-50" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground uppercase tracking-tight">Nenhum conjunto encontrado</h3>
                            <p className="text-muted-foreground text-xs uppercase tracking-wide mt-2">Tente ajustar seus filtros de busca</p>
                        </motion.div>
                    ) : (
                        paginatedAdSets?.map((adSet: any) => {
                            const isSelected = selectedAdSetIds.has(adSet.id);
                            return (
                            <motion.div
                                key={adSet.id}
                                layout
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                onClick={() => navigate(criativosPath({ adSetId: adSet.id, campaignId: adSet.campaign_id }))}
                                className={`p-6 rounded-[2rem] border bg-card hover:bg-muted/50 transition-all cursor-pointer group relative overflow-hidden shadow-sm ${
                                    isSelected
                                        ? isBranding
                                            ? 'border-ch-orange/40 ring-1 ring-ch-orange/30'
                                            : 'border-primary/40 ring-1 ring-primary/30'
                                        : 'border-border hover:border-primary/20'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleSelectAdSet(adSet.id); }}
                                    className="absolute top-4 left-4 z-20 p-1 rounded-md hover:bg-muted/80 transition-colors"
                                    title={isSelected ? 'Remover seleção' : 'Selecionar para análise em lote'}
                                >
                                    {isSelected
                                        ? <CheckSquare className={`w-5 h-5 ${isBranding ? 'text-ch-orange' : 'text-primary'}`} />
                                        : <Square className="w-5 h-5 text-muted-foreground" />}
                                </button>

                                <div className={cn(
                                    'grid grid-cols-1 items-center gap-6 xl:gap-8 relative z-10 min-w-0',
                                    isBranding
                                        ? 'xl:grid-cols-[1fr_auto_48px]'
                                        : 'xl:grid-cols-[1fr_minmax(0,1fr)_48px]',
                                )}>
                                    <div className="flex items-start gap-5 min-w-0">
                                        <div className={`p-4 rounded-2xl transition-all duration-500 ${adSet.status === 'active'
                                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                            : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                                            }`}>
                                            {adSet.status === 'active' ? <Activity className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] font-semibold border-0 py-0.5 px-2.5 rounded-md ${adSet.status === 'active'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500'
                                                        : 'bg-muted text-muted-foreground'
                                                        }`}
                                                >
                                                    {adSet.status === 'active' ? 'Em Otimização' : 'Pausado'}
                                                </Badge>
                                                {(() => {
                                                    const counts = complianceByAdSet?.get(adSet.id);
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
                                                            title={`${prefix}: ${counts.approved} ok, ${counts.rejected} fora da regra`}
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
                                                <span className="text-[10px] font-medium text-muted-foreground/70 font-mono">ID: {adSet.id.slice(0, 8)}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors mb-2">
                                                {adSet.name}
                                            </h3>
                                            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                                                <div className="flex items-center gap-1.5">
                                                    <Target className="w-3.5 h-3.5 text-primary" />
                                                    {adSet.optimization_goal}
                                                </div>
                                                <span className="w-1 h-1 rounded-full bg-border" />
                                                <div className="flex items-center gap-1.5">
                                                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                                                    {formatCurrency(Number(adSet.daily_budget))} / dia
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Metrics — branding shows only compliance */}
                                    {isBranding ? (
                                        <div className="flex flex-col items-end gap-1.5">
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Branding</p>
                                            <BrandingCounts counts={brandingCompliance?.byAdSet.get(adSet.id)} />
                                        </div>
                                    ) : (
                                    <div className={inlineMetricsGrid}>
                                        <div className="space-y-1 min-w-0">
                                            <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                                                <DollarSign className="w-3 h-3 text-emerald-500" /> Gasto
                                            </p>
                                            <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">
                                                {formatCurrency(adSet.aggregated_metrics?.spend || 0)}
                                            </p>
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                                                <Eye className="w-3 h-3 text-blue-500" /> Impr.
                                            </p>
                                            <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">
                                                {formatNumber(adSet.aggregated_metrics?.impressions || 0)}
                                            </p>
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                                                <MousePointer className="w-3 h-3 text-purple-500" /> Cliques
                                            </p>
                                            <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">
                                                {formatNumber(adSet.aggregated_metrics?.clicks || 0)}
                                            </p>
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                                                <Target className="w-3 h-3 text-ch-orange" /> Conv.
                                            </p>
                                            <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">
                                                {adSet.aggregated_metrics?.conversions || 0}
                                            </p>
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                                                <TrendingUp className="w-3 h-3 text-indigo-500" /> CTR
                                            </p>
                                            <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">
                                                {adSet.aggregated_metrics?.ctr ? `${adSet.aggregated_metrics.ctr.toFixed(2)}%` : '0.00%'}
                                            </p>
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                                                <BarChart3 className="w-3 h-3 text-amber-500" /> CPA
                                            </p>
                                            <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">
                                                {adSet.aggregated_metrics?.conversions && adSet.aggregated_metrics.conversions > 0
                                                    ? formatCurrency(adSet.aggregated_metrics.cpa)
                                                    : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    )}

                                    <div className="hidden lg:flex items-center justify-center w-12 h-12 rounded-full border border-border bg-card group-hover:bg-primary group-hover:border-primary transition-all duration-300 transform group-hover:-rotate-45">
                                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
                                    </div>
                                </div>

                                {!isBranding && adSet.status === 'active' && (
                                    <div className="mt-6 pt-5 border-t border-border flex items-center justify-between gap-3 relative z-10">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            {t('insight')}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="shrink-0 h-8 text-xs font-semibold rounded-lg border-primary/30 hover:bg-primary/10 hover:text-primary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void handleAdSetAiAnalysis(adSet.id, adSet.name, adSet.campaign_id);
                                            }}
                                            disabled={runAdSetAudit.isPending}
                                        >
                                            <BrainCircuit className="w-3.5 h-3.5 mr-1.5" />
                                            {t('aiAnalysisButton')}
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
            {filteredAdSets && filteredAdSets.length > ITEMS_PER_PAGE && (
                <motion.div
                    variants={item}
                    className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border"
                >
                    <div className="text-sm text-muted-foreground">
                        Exibindo <span className="font-bold text-foreground">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> a{' '}
                        <span className="font-bold text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredAdSets.length)}</span> de{' '}
                        <span className="font-bold text-foreground">{filteredAdSets.length}</span> conjuntos
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="h-9 px-4 rounded-xl border-border hover:bg-muted/50"
                        >
                            Anterior
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
                            Próxima
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* B1: rule selector + queued check modal */}
            <SelectRuleDialog
                isOpen={isRuleSelectorOpen}
                onClose={() => setIsRuleSelectorOpen(false)}
                onConfirm={(ids) => { void startBatchAnalysis(ids); }}
                title={`Analisar ${selectedAdSetIds.size} conjunto${selectedAdSetIds.size !== 1 ? 's' : ''}`}
                description="Selecione as regras a aplicar nos criativos dos conjuntos escolhidos."
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

            <SelectAnalysisScopeDialog
                open={isScopeDialogOpen}
                onOpenChange={setIsScopeDialogOpen}
                entityLabel="conjunto"
                entityCount={selectedAdSetIds.size}
                creativeEstimate={creativeEstimate}
                onConfirm={(scope) => void runPerformanceBatch(scope)}
                isLoading={batchBusy}
            />

            <PerformanceEntityAuditDialog
                open={entityAuditOpen}
                onOpenChange={setEntityAuditOpen}
                audit={entityAudit}
                entityName={entityAuditName}
                entityLevel="ad_set"
                viewCreativesHref={
                    entityAuditAdSetId
                        ? criativosPath({ adSetId: entityAuditAdSetId, campaignId: entityAuditCampaignId ?? undefined })
                        : undefined
                }
                onReanalyze={entityAuditAdSetId && entityAuditCampaignId ? () => {
                    void handleAdSetAiAnalysis(entityAuditAdSetId, entityAuditName, entityAuditCampaignId);
                } : undefined}
                isReanalyzing={runAdSetAudit.isPending}
            />
        </motion.div>
    );
}
