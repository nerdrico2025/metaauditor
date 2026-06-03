import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { conjuntosPath, criativosPath } from '@/lib/campaignNavigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { useCampaignAction } from '@/hooks/useCampaignAction';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { statsGridCols } from '@/lib/responsiveGrids';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft,
    Play,
    Pause,
    TrendingUp,
    DollarSign,
    Target,
    Eye,
    MousePointer,
    Edit,
    Loader2,
    AlertCircle,
    Calendar,
    ChevronRight,
    Settings,
    ShieldCheck,
    Megaphone,
    Activity,
    Users,
    BarChart3,
    Sparkles,
    Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { EntityPerformanceAuditCard } from '@/components/audits/EntityPerformanceAuditCard';

interface CampaignDetail {
    id: string;
    name: string;
    status: string;
    objective?: string;
    daily_budget?: number;
    lifetime_budget?: number;
    spend?: number;
    impressions?: number;
    clicks?: number;
    conversions?: number;
    created_at: string;
    updated_at: string;
    external_id?: string;
    bid_strategy?: string;
}

export default function CampanhaDetalhe() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { range: dateRange } = useDateFilter();
    const [isEditing, setIsEditing] = useState(false);
    const [editedBudget, setEditedBudget] = useState<number | null>(null);

    const campaignAction = useCampaignAction();
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);

    const { data: campaign, isLoading } = useQuery({
        queryKey: ['campaign', id, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            // Fetch campaign data
            const { data: campaignData, error: campaignError } = await supabase
                .from('campaigns')
                .select('*')
                .eq('id', id)
                .single();

            if (campaignError) throw campaignError;

            // Fetch aggregated metrics from campaign_metrics (optionally filtered by date)
            let metricsQuery = supabase
                .from('campaign_metrics')
                .select('impressions, clicks, spend, conversions, reach, cpc, cpm')
                .eq('campaign_id', id);

            if (!dateRange.isAll && dateRange.startDate && dateRange.endDate) {
                metricsQuery = metricsQuery
                    .gte('date', dateRange.startDate)
                    .lte('date', dateRange.endDate);
            }

            const { data: metrics, error: metricsError } = await metricsQuery;

            if (metricsError) console.error('Metrics error:', metricsError);

            // Aggregate metrics
            const totalImpressions = metrics?.reduce((sum, m) => sum + (Number(m.impressions) || 0), 0) || 0;
            const totalClicks = metrics?.reduce((sum, m) => sum + (Number(m.clicks) || 0), 0) || 0;
            const totalSpend = metrics?.reduce((sum, m) => sum + (Number(m.spend) || 0), 0) || 0;
            const totalConversions = metrics?.reduce((sum, m) => sum + (Number(m.conversions) || 0), 0) || 0;
            // Reach is unique users — summing daily reach double-counts. Use MAX as a
            // non-zero approximation (lifetime reach would require a separate non-incremental call).
            let totalReach = metrics?.reduce((max, m) => Math.max(max, Number(m.reach) || 0), 0) || 0;

            // Meta often leaves campaign_metrics.reach NULL while ad_set_metrics has reach.
            if (totalReach === 0 && totalImpressions > 0 && id) {
                const sb = supabase as any;
                const { data: adSetRows } = await sb.from('ad_sets').select('id').eq('campaign_id', id);
                const adSetIds = adSetRows?.map((r: { id: string }) => r.id) ?? [];
                if (adSetIds.length > 0) {
                    let asm = sb.from('ad_set_metrics').select('date, reach').in('ad_set_id', adSetIds);
                    if (!dateRange.isAll && dateRange.startDate && dateRange.endDate) {
                        asm = asm.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
                    }
                    const { data: asmRows } = await asm;
                    const byDate = new Map<string, number>();
                    for (const r of (asmRows ?? []) as { date: string; reach: number | null }[]) {
                        if (!r.date) continue;
                        const rv = Number(r.reach) || 0;
                        byDate.set(r.date, Math.max(byDate.get(r.date) ?? 0, rv));
                    }
                    totalReach = [...byDate.values()].reduce((mx, v) => Math.max(mx, v), 0);
                }
            }

            return {
                ...campaignData,
                impressions: totalImpressions,
                clicks: totalClicks,
                spend: totalSpend,
                conversions: totalConversions,
                reach: totalReach,
            } as unknown as CampaignDetail;
        },
    });

    const { data: adSets, isLoading: isLoadingAdSets } = useQuery({
        queryKey: ['campaign-adsets', id, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            const { data: rows, error } = await supabase
                .from('ad_sets')
                .select('*')
                .eq('campaign_id', id);
            if (error) throw error;
            if (!rows || rows.length === 0) return [];

            const adSetIds = rows.map((r: any) => r.id);
            const totalsByAdSet = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number }>();

            if (!dateRange.isAll && dateRange.startDate && dateRange.endDate) {
                // Date filter active: sum from ad_set_metrics within period
                const { data: metrics, error: metricsError } = await (supabase as any)
                    .from('ad_set_metrics')
                    .select('ad_set_id, spend, clicks, impressions, conversions, date')
                    .in('ad_set_id', adSetIds)
                    .gte('date', dateRange.startDate)
                    .lte('date', dateRange.endDate);
                if (metricsError) console.error('AdSet metrics error:', metricsError);
                (metrics || []).forEach((m: any) => {
                    if (!m.ad_set_id) return;
                    const cur = totalsByAdSet.get(m.ad_set_id) || { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
                    cur.impressions += Number(m.impressions) || 0;
                    cur.clicks += Number(m.clicks) || 0;
                    cur.spend += Number(m.spend) || 0;
                    cur.conversions += Number(m.conversions) || 0;
                    totalsByAdSet.set(m.ad_set_id, cur);
                });
            } else {
                // No filter: aggregate lifetime totals from creatives (same source Criativos page uses)
                const { data: creatives, error: creativesError } = await supabase
                    .from('creatives')
                    .select('ad_set_id, spend, clicks, impressions, conversions')
                    .in('ad_set_id', adSetIds);
                if (creativesError) console.error('Creatives error:', creativesError);
                (creatives || []).forEach((c: any) => {
                    if (!c.ad_set_id) return;
                    const cur = totalsByAdSet.get(c.ad_set_id) || { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
                    cur.impressions += Number(c.impressions) || 0;
                    cur.clicks += Number(c.clicks) || 0;
                    cur.spend += Number(c.spend) || 0;
                    cur.conversions += Number(c.conversions) || 0;
                    totalsByAdSet.set(c.ad_set_id, cur);
                });
            }

            const merged = rows.map((r: any) => {
                const t = totalsByAdSet.get(r.id) || { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
                return { ...r, ...t };
            });

            merged.sort((a: any, b: any) => (b.impressions || 0) - (a.impressions || 0));
            return merged;
        },
        enabled: !!id,
    });

    const formatPercent = (value: number) => {
        if (value === undefined || value === null || isNaN(value)) return '0.00%';
        return `${value.toFixed(2)}%`;
    };

    const handleSaveBudget = async () => {
        if (editedBudget === null || editedBudget <= 0 || !id) return;
        try {
            await campaignAction.mutateAsync({
                campaign_id: id,
                action: 'update_budget',
                payload: { daily_budget: Math.round(editedBudget * 100) },
            });
            queryClient.invalidateQueries({ queryKey: ['campaign', id] });
            setIsEditing(false);
        } catch {
            // toast handled inside hook
        }
    };

    const handleToggleStatus = async () => {
        if (!campaign || !id) return;
        const isActive = campaign.status === 'ACTIVE' || campaign.status === 'active';
        try {
            await campaignAction.mutateAsync({
                campaign_id: id,
                action: isActive ? 'pause' : 'activate',
            });
            queryClient.invalidateQueries({ queryKey: ['campaign', id] });
        } catch {
            // toast handled inside hook
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-ch-orange" />
            </div>
        );
    }

    const budget = campaign.daily_budget || campaign.lifetime_budget || 0;
    const spend = campaign.spend || 0;
    const impressions = campaign.impressions || 0;
    const clicks = campaign.clicks || 0;
    const conversions = campaign.conversions || 0;
    const reach = (campaign as any).reach || 0;

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    const frequency = reach > 0 ? impressions / reach : 0;
    const budgetUsagePercent = budget > 0 ? (spend / budget) * 100 : 0;

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            className="p-6 space-y-8"
        >
            {/* Header */}
            <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(conjuntosPath(id))}
                        className="h-12 w-12 bg-muted/50 border border-border hover:bg-ch-orange/10 hover:text-ch-orange transition-all duration-300 rounded-2xl group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-widest">
                            <span className="hover:text-ch-orange transition-colors cursor-pointer" onClick={() => navigate(conjuntosPath(id))}>Gestão de Tráfego</span>
                            <ChevronRight className="w-3 h-3 opacity-30" />
                            <span className="text-foreground">Estrutura de Campanha</span>
                        </div>
                        <h1 className="text-3xl font-bold text-foreground tracking-tight uppercase">{campaign.name}</h1>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">ID: {campaign.external_id || id}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                Criada em {format(new Date(campaign.created_at), "dd 'de' MMM", { locale: ptBR })}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <DateRangeFilter />
                    <div className="flex items-center gap-2 px-4 py-2 bg-ch-orange/5 border border-ch-orange/10 rounded-xl mr-2">
                        <Activity className="w-4 h-4 text-ch-orange" />
                        <span className="text-[10px] font-bold text-ch-orange uppercase tracking-widest">Performance Ativa</span>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="bg-foreground text-background hover:bg-ch-orange font-bold uppercase tracking-widest rounded-xl transition-all h-12 px-6 shadow-sm group">
                                Controle <Settings className="ml-2 h-4 w-4 group-hover:rotate-45 transition-transform" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border border-border w-64 shadow-sm p-2 rounded-2xl">
                            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2">Gerenciamento</DropdownMenuLabel>
                            {(campaign.status === 'ACTIVE' || campaign.status === 'active') ? (
                                <DropdownMenuItem disabled={campaignAction.isPending} onClick={handleToggleStatus} className="py-3 px-3 cursor-pointer rounded-xl hover:bg-amber-500/10 text-amber-500 transition-colors">
                                    <Pause className="mr-3 h-4 w-4" /> <span className="font-bold">Interromper Veiculação</span>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem disabled={campaignAction.isPending} onClick={handleToggleStatus} className="py-3 px-3 cursor-pointer rounded-xl hover:bg-emerald-500/10 text-emerald-500 transition-colors">
                                    <Play className="mr-3 h-4 w-4" /> <span className="font-bold">Retomar Campanha</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-border my-1" />
                            <DropdownMenuItem onClick={() => setIsEditing(true)} className="py-3 px-3 cursor-pointer rounded-xl hover:bg-ch-orange/10 text-ch-orange transition-colors">
                                <DollarSign className="mr-3 h-4 w-4" /> <span className="font-bold">Calibrar Orçamento</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </motion.div>

            {/* Quick Insights Grid - Expanded with Real Data */}
            <motion.div variants={item} className={cn('grid gap-4', statsGridCols[6])}>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:translate-y-[-4px] transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-ch-orange/10 rounded-xl">
                            <DollarSign className="w-4 h-4 text-ch-orange" />
                        </div>
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Gasto Total</p>
                    <h3 className="text-2xl font-bold text-foreground tracking-tighter tabular-nums group-hover:text-ch-orange transition-colors">{formatCurrency(spend)}</h3>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:translate-y-[-4px] transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl">
                            <Eye className="w-4 h-4 text-blue-500" />
                        </div>
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Impressões</p>
                    <h3 className="text-2xl font-bold text-foreground tracking-tighter tabular-nums group-hover:text-blue-500 transition-colors">{formatNumber(impressions)}</h3>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:translate-y-[-4px] transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-purple-500/10 rounded-xl">
                            <MousePointer className="w-4 h-4 text-purple-500" />
                        </div>
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Cliques</p>
                    <h3 className="text-2xl font-bold text-foreground tracking-tighter tabular-nums group-hover:text-purple-500 transition-colors">{formatNumber(clicks)}</h3>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:translate-y-[-4px] transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                            <Target className="w-4 h-4 text-emerald-500" />
                        </div>
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Resultado</p>
                    <h3 className="text-2xl font-bold text-foreground tracking-tighter tabular-nums group-hover:text-emerald-500 transition-colors">{formatNumber(conversions)}</h3>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:translate-y-[-4px] transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                        </div>
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">CTR</p>
                    <h3 className="text-2xl font-bold text-foreground tracking-tighter tabular-nums group-hover:text-indigo-500 transition-colors">{formatPercent(ctr)}</h3>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:translate-y-[-4px] transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-amber-500/10 rounded-xl">
                            <BarChart3 className="w-4 h-4 text-amber-500" />
                        </div>
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">CPC</p>
                    <h3 className="text-2xl font-bold text-foreground tracking-tighter tabular-nums group-hover:text-amber-500 transition-colors">{formatCurrency(cpc)}</h3>
                </div>
            </motion.div>

            {/* Additional Metrics Row */}
            <motion.div variants={item} className={cn('grid gap-4', statsGridCols[4])}>
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">CPM</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{formatCurrency(cpm)}</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">CPA</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{conversions > 0 ? formatCurrency(cpa) : 'N/A'}</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Taxa de Conversão</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{formatPercent(conversionRate)}</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Alcance</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{formatNumber(reach)}</p>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Ad Sets List */}
                <motion.div variants={item} className="lg:col-span-2 space-y-8">
                    {/* Diagnóstico de performance (entidade) */}
                    {id && campaign && (
                        <EntityPerformanceAuditCard
                            entityId={id}
                            entityName={campaign.name}
                            level="campaign"
                            campaignId={id}
                        />
                    )}

                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <Megaphone className="w-5 h-5 text-ch-orange" />
                            Conjuntos de Anúncios
                        </h2>
                        <Badge variant="outline" className="bg-muted text-muted-foreground font-bold border-border">
                            {adSets?.length || 0} CONJUNTOS
                        </Badge>
                    </div>

                    <div className="grid gap-4">
                        {isLoadingAdSets ? (
                            <div className="p-12 flex flex-col items-center justify-center bg-card border border-border rounded-3xl opacity-50 border-dashed">
                                <Loader2 className="w-8 h-8 animate-spin text-ch-orange mb-3" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">Aguardando dados estruturais...</p>
                            </div>
                        ) : adSets && adSets.length > 0 ? (
                            adSets.map((adSet: any) => (
                                <div
                                    key={adSet.id}
                                    onClick={() => navigate(criativosPath({ adSetId: adSet.id, campaignId: id }))}
                                    className="bg-card border border-border rounded-2xl shadow-sm p-5 flex items-center justify-between group hover:border-ch-orange/30 cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-ch-orange/10 group-hover:text-ch-orange transition-colors">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground group-hover:text-ch-orange transition-colors">{adSet.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[8px] font-bold uppercase px-1.5 py-0 ${adSet.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}
                                                >
                                                    {adSet.status === 'active' ? 'Ativo' : 'Pausado'}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                                                    {formatCurrency((adSet.spend || 0))} gastos
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">CTR</p>
                                            <p className="font-bold text-foreground tabular-nums tracking-tight">
                                                {formatPercent(adSet.impressions > 0 ? ((adSet.clicks || 0) / adSet.impressions) * 100 : 0)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">CLIQUES</p>
                                            <p className="font-bold text-foreground tabular-nums tracking-tight">
                                                {formatNumber(adSet.clicks || 0)}
                                            </p>
                                        </div>
                                        <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-ch-orange text-muted-foreground group-hover:text-white transition-all">
                                            <ChevronRight className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 flex flex-col items-center justify-center bg-card border border-border rounded-3xl border-dashed">
                                <Megaphone className="w-8 h-8 text-muted-foreground opacity-20 mb-3" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nenhum conjunto encontrado</p>
                                <Button variant="link" className="mt-2 text-ch-orange text-xs">Criar primeiro conjunto agora</Button>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Sidebar: Technical Parameters & Budget */}
                <motion.div variants={item} className="space-y-6">
                    {/* Budget Management */}
                    <div className="bg-card border border-border rounded-3xl shadow-sm p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground uppercase tracking-tighter flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-ch-orange" />
                                Orçamento
                            </h2>
                            {isEditing && (
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Cotação Diária</label>
                                {isEditing ? (
                                    <div className="relative group">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ch-orange group-focus-within:scale-110 transition-transform" />
                                        <Input
                                            type="number"
                                            autoFocus
                                            value={editedBudget || ''}
                                            onChange={(e) => setEditedBudget(parseFloat(e.target.value))}
                                            className="h-14 pl-10 bg-muted/50 border-border rounded-2xl font-bold text-lg focus:ring-ch-orange shadow-inner"
                                        />
                                        <Button
                                            size="sm"
                                            onClick={handleSaveBudget}
                                            disabled={campaignAction.isPending}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-ch-orange hover:bg-ch-orange/90 rounded-xl font-bold uppercase text-[10px] px-4"
                                        >
                                            {campaignAction.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div
                                        className="h-14 flex items-center justify-between px-5 bg-muted/30 border border-border rounded-2xl hover:border-ch-orange/40 transition-all cursor-pointer group"
                                        onClick={() => { setIsEditing(true); setEditedBudget(budget); }}
                                    >
                                        <p className="text-xl font-bold text-foreground tracking-tighter">
                                            {formatCurrency(budget)}
                                        </p>
                                        <Edit className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">
                                    <span>Vazão de Verba</span>
                                    <span className={budgetUsagePercent > 90 ? 'text-rose-500' : 'text-foreground'}>
                                        {budgetUsagePercent.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="h-3 bg-muted rounded-full overflow-hidden p-0.5 border border-border/50 shadow-inner">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, budgetUsagePercent)}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className={`h-full rounded-full transition-all ${budgetUsagePercent > 90 ? 'bg-rose-500' : budgetUsagePercent > 70 ? 'bg-amber-500' : 'bg-ch-orange'
                                            }`}
                                    />
                                </div>
                            </div>
                        </div>

                        {budgetUsagePercent > 90 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-start gap-3"
                            >
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-rose-500/80 uppercase leading-relaxed tracking-wide">
                                    Atenção: Campanha operando com orçamento quase exaurido. Recomenda-se aumento estratégico (+20%) para manter o fluxo.
                                </p>
                            </motion.div>
                        )}
                    </div>

                    {/* Technical Parameters */}
                    <div className="bg-card border border-border rounded-3xl shadow-sm p-6">
                        <h2 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2 mb-6">
                            <Settings className="w-4 h-4 text-ch-orange" />
                            Parâmetros Estruturais
                        </h2>

                        <div className="space-y-6">
                            {[
                                { label: 'Objetivo Principal', value: campaign.objective || 'Vendas', icon: Target },
                                { label: 'Estratégia de Lance', value: campaign.bid_strategy || 'Menor Custo', icon: BarChart3 },
                                { label: 'Status Global', value: campaign.status === 'ACTIVE' ? 'Ativa' : 'Pausada', icon: Activity },
                                { label: 'Segmentação', value: 'Otimizada via IA', icon: ShieldCheck }
                            ].map((param, idx) => (
                                <div key={idx} className="flex items-center gap-4 group">
                                    <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:text-ch-orange group-hover:bg-ch-orange/5 transition-all">
                                        <param.icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{param.label}</p>
                                        <p className="text-xs font-bold text-foreground uppercase tracking-tight">{param.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
