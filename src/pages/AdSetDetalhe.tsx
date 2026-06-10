import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { conjuntosPath } from '@/lib/campaignNavigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { getProxiedImageUrl, formatCurrency, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    Megaphone,
    Play,
    Pause,
    Loader2,
    DollarSign,
    Eye,
    MousePointerClick,
    Target,
    MapPin,
    Users,
    Globe,
    ChevronRight,
    TrendingUp,
    ShieldCheck,
    Zap,
    Settings,
    Activity,
    Sparkles,
    Trash2,
    Info,
    Archive,
    AlertTriangle
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const formatPercent = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00%';
    return `${value.toFixed(2)}%`;
};

const cleanName = (name: string) => {
    if (!name) return '';
    return name
        .replace(/[_-]/g, ' ') // Replace underscores/hyphens with spaces
        .replace(/\.(mp4|jpg|png|jpeg|mov|gif|webp)$/i, '') // Remove extensions
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase()) // Title Case
        .replace(/^(Img|Video|Carrossel)\s+/i, ''); // Remove prefixes
};

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { EntityPerformanceAuditCard } from '@/components/audits/EntityPerformanceAuditCard';
import { useModule } from '@/contexts/ModuleContext';
import { useBrandingCompliance } from '@/hooks/useBrandingCompliance';
import { BrandingCounts } from '@/components/branding/BrandingCounts';

export default function AdSetDetalhe() {
    const { id: campaignId, adsetId } = useParams<{ id: string; adsetId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);
    const { range: dateRange } = useDateFilter();
    const dateFilterActive =
        !dateRange.isAll && !!dateRange.startDate && !!dateRange.endDate;
    const { module } = useModule();
    const isBranding = module === 'branding';
    const { data: brandingCompliance } = useBrandingCompliance();

    const [isBudgetOpen, setIsBudgetOpen] = useState(false);
    const [newDailyBudget, setNewDailyBudget] = useState('');
    const [newLifetimeBudget, setNewLifetimeBudget] = useState('');

    const { data: adSet, isLoading } = useQuery({
        queryKey: ['adset', adsetId],
        queryFn: async () => {
            if (!adsetId) throw new Error('No adSet ID');

            const { data, error } = await supabase
                .from('ad_sets')
                .select('*, campaigns(name)')
                .eq('id', adsetId)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!adsetId,
    });

    const { data: creatives } = useQuery({
        queryKey: ['adset-creatives', adsetId],
        queryFn: async () => {
            if (!adsetId) throw new Error('No adSet ID');

            const { data, error } = await supabase
                .from('creatives')
                .select('*')
                .eq('ad_set_id', adsetId)
                .order('impressions', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: !!adsetId,
    });

    // Metrics aggregated for the selected period (only when a date filter is active)
    const { data: periodMetrics, isPending: isAdSetPeriodPending } = useQuery({
        queryKey: ['adset-metrics', adsetId, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!adsetId) return null;
            const { data, error } = await (supabase as any)
                .from('ad_set_metrics')
                .select('impressions, clicks, spend, conversions')
                .eq('ad_set_id', adsetId)
                .gte('date', dateRange.startDate!)
                .lte('date', dateRange.endDate!);
            if (error) { console.error('AdSet period metrics error:', error); return null; }
            const totals = (data || []).reduce((acc: any, m: any) => ({
                impressions: acc.impressions + (Number(m.impressions) || 0),
                clicks: acc.clicks + (Number(m.clicks) || 0),
                spend: acc.spend + (Number(m.spend) || 0),
                conversions: acc.conversions + (Number(m.conversions) || 0),
            }), { impressions: 0, clicks: 0, spend: 0, conversions: 0 });
            return totals;
        },
        enabled: !!adsetId && dateFilterActive && !isBranding,
    });

    // Per-creative metrics within the selected period. Without this, each creative
    // card shows lifetime spend (creatives.spend) which can exceed the date-filtered
    // ad set total and confuse users (PDF item 5).
    const { data: creativePeriodMetrics, isPending: isCreativePeriodPending } = useQuery({
        queryKey: ['adset-creative-metrics', adsetId, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!adsetId || !creatives || creatives.length === 0) return new Map<string, any>();
            const ids = creatives.map(c => c.id);
            const { data, error } = await (supabase as any)
                .from('creative_metrics')
                .select('creative_id, impressions, clicks, spend, conversions')
                .in('creative_id', ids)
                .gte('date', dateRange.startDate!)
                .lte('date', dateRange.endDate!);
            if (error) { console.error('Creative period metrics error:', error); return new Map(); }
            const byId = new Map<string, any>();
            (data || []).forEach((m: any) => {
                const cur = byId.get(m.creative_id) || { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
                cur.impressions += Number(m.impressions) || 0;
                cur.clicks += Number(m.clicks) || 0;
                cur.spend += Number(m.spend) || 0;
                cur.conversions += Number(m.conversions) || 0;
                byId.set(m.creative_id, cur);
            });
            return byId;
        },
        enabled: !!adsetId && !!creatives && creatives.length > 0 && dateFilterActive && !isBranding,
    });

    const adSetAction = useMutation({
        mutationFn: async ({ action, payload }: { action: string, payload?: any }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-adset-action`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    adset_id: adsetId,
                    action,
                    payload
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to perform action');
            }

            return response.json();
        },
        onSuccess: (data, variables) => {
            toast.success(`Ação ${variables.action} realizada com sucesso`);
            queryClient.invalidateQueries({ queryKey: ['adset', adsetId] });
            setIsBudgetOpen(false);
        },
        onError: (error) => {
            toast.error(`Erro: ${error.message}`);
        }
    });

    const handleUpdateBudget = () => {
        const payload: any = {};
        if (newDailyBudget) payload.daily_budget = parseFloat(newDailyBudget.replace(',', '.')) * 100;
        if (newLifetimeBudget) payload.lifetime_budget = parseFloat(newLifetimeBudget.replace(',', '.')) * 100;

        if (Object.keys(payload).length === 0) return;
        adSetAction.mutate({ action: 'update_budget', payload });
    };

    const handleOpenBudget = () => {
        setNewDailyBudget(adSet?.daily_budget ? (adSet.daily_budget).toString() : '');
        setNewLifetimeBudget(adSet?.lifetime_budget ? (adSet.lifetime_budget).toString() : '');
        setIsBudgetOpen(true);
    };

    const renderTargeting = (targeting: any) => {
        if (!targeting) return (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-3xl opacity-40">
                <Globe className="w-8 h-8 mb-2" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-center">Segmentação Ampla Detectada</p>
            </div>
        );

        return (
            <div className="space-y-6">
                {targeting.geo_locations?.countries && (
                    <div className="bg-muted/20 border border-border p-4 rounded-2xl group hover:border-ch-orange/30 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-3.5 h-3.5 text-ch-orange" />
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Geolocalização</span>
                        </div>
                        <span className="text-sm font-bold text-foreground uppercase tracking-tight">
                            {targeting.geo_locations.countries.join(', ')}
                        </span>
                    </div>
                )}

                <div className="bg-muted/20 border border-border p-4 rounded-2xl group hover:border-ch-orange/30 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-3.5 h-3.5 text-ch-orange" />
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Demográfico Principal</span>
                    </div>
                    <span className="text-sm font-bold text-foreground tracking-widest tabular-nums">
                        IDADE: {targeting.age_min || 18} - {targeting.age_max || 65}+ ANOS
                    </span>
                </div>

                {targeting.flexible_spec && (
                    <div className="bg-muted/20 border border-border p-4 rounded-2xl">
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="w-3.5 h-3.5 text-ch-orange" />
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Matriz de Interesses</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {targeting.flexible_spec.flatMap((spec: any) =>
                                spec.interests?.map((interest: any) => (
                                    <span key={interest.id} className="bg-ch-orange/5 text-ch-orange px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-ch-orange/10 hover:bg-ch-orange/10 transition-all">
                                        {interest.name}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const getStatusBadge = (status: string) => {
        const configs: Record<string, { label: string; color: string; icon: any }> = {
            active: { label: 'Ativo', color: 'emerald-500', icon: Play },
            paused: { label: 'Pausado', color: 'amber-500', icon: Pause },
            archived: { label: 'Arquivado', color: 'slate-500', icon: Archive },
            error: { label: 'Erro', color: 'rose-500', icon: AlertTriangle },
        };

        const cfg = configs[status.toLowerCase()] || configs.paused;
        const Icon = cfg.icon;

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-${cfg.color}/10 text-${cfg.color} border border-${cfg.color}/20 shadow-sm`}>
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
            </span>
        );
    };

    if (isLoading || !adSet || (!isBranding && dateFilterActive && (isAdSetPeriodPending || (creatives && creatives.length > 0 && isCreativePeriodPending)))) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[500px] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-ch-orange opacity-40" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Consolidando dados do conjunto...</p>
            </div>
        );
    }

    // When a date range is selected, never fall back to lifetime creatives.spend on cards
    // (it inflates vs ad_set_metrics — PDF item 5). Use period rows only, else zero.
    const creativeStats = creatives?.map(c => {
        const periodRow = creativePeriodMetrics?.get(c.id);
        if (dateFilterActive) {
            if (periodRow) {
                return {
                    ...c,
                    impressions: periodRow.impressions,
                    clicks: periodRow.clicks,
                    conversions: periodRow.conversions,
                    realSpend: periodRow.spend,
                };
            }
            return {
                ...c,
                impressions: 0,
                clicks: 0,
                conversions: 0,
                realSpend: 0,
            };
        }
        return {
            ...c,
            realSpend: Number(c.spend) || (c.clicks || 0) * (Number(c.cpc) || 0),
        };
    }) || [];

    const totalImpressions = periodMetrics
        ? periodMetrics.impressions
        : (adSet.impressions || creativeStats.reduce((sum, c) => sum + (c.impressions || 0), 0));
    const totalClicks = periodMetrics
        ? periodMetrics.clicks
        : (adSet.clicks || creativeStats.reduce((sum, c) => sum + (c.clicks || 0), 0));
    const totalSpend = periodMetrics
        ? periodMetrics.spend
        : (Number(adSet.spend) || creativeStats.reduce((sum, c) => sum + (c.realSpend || 0), 0));
    const totalConversions = periodMetrics
        ? periodMetrics.conversions
        : (adSet.conversions || creativeStats.reduce((sum, c) => sum + (c.conversions || 0), 0));

    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

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
                        onClick={() => navigate(conjuntosPath(campaignId))}
                        className="h-12 w-12 bg-muted/50 border border-border hover:bg-ch-orange/10 hover:text-ch-orange transition-all duration-300 rounded-2xl group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-widest">
                            <span className="hover:text-ch-orange transition-colors cursor-pointer" onClick={() => navigate(conjuntosPath(campaignId))}>Campanha</span>
                            <ChevronRight className="w-3 h-3 opacity-30" />
                            <span className="text-foreground">Estrutura de Público</span>
                        </div>
                        <h1 className="text-3xl font-bold text-foreground tracking-tight uppercase">{adSet.name}</h1>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[11px] font-bold text-muted-foreground tracking-wider">REF: {adSet.external_id}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{adSet.optimization_goal?.replace(/_/g, ' ') || 'Conversões'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isBranding && <DateRangeFilter />}
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mr-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Público Qualificado</span>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="bg-foreground text-background hover:bg-ch-orange font-bold uppercase tracking-widest rounded-xl transition-all h-12 px-6 shadow-xl group">
                                Ações de Gestão <Settings className="ml-2 h-4 w-4 group-hover:rotate-45 transition-transform" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border border-border w-60">
                            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Centro de Operações</DropdownMenuLabel>
                            {adSet.status === 'active' ? (
                                <DropdownMenuItem onClick={() => adSetAction.mutate({ action: 'pause' })} className="py-3 cursor-pointer">
                                    <Pause className="mr-3 h-4 w-4 text-amber-500" /> <span className="font-bold">Congelar Conjunto</span>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onClick={() => adSetAction.mutate({ action: 'activate' })} className="py-3 cursor-pointer">
                                    <Play className="mr-3 h-4 w-4 text-emerald-500" /> <span className="font-bold">Descongelar Conjunto</span>
                                </DropdownMenuItem>
                            )}
                            {!isBranding && (
                            <>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem onClick={handleOpenBudget} className="py-3 cursor-pointer">
                                <DollarSign className="mr-3 h-4 w-4 text-teal-500" /> Calibrar Orçamento
                            </DropdownMenuItem>
                            </>
                            )}
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem className="py-3 text-rose-500 opacity-50 cursor-not-allowed">
                                <Trash2 className="mr-3 h-4 w-4" /> Descartar Público
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </motion.div>

            {/* Metrics Snapshot */}
            {isBranding ? (
                <motion.div variants={item} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Conformidade de Branding</p>
                    <BrandingCounts counts={adsetId ? brandingCompliance?.byAdSet.get(adsetId) : undefined} />
                </motion.div>
            ) : (
            <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Impressões Totais', value: formatNumber(totalImpressions), icon: Eye, color: 'blue-500' },
                    { label: 'Cliques Totais', value: formatNumber(totalClicks), icon: MousePointerClick, color: 'indigo-500' },
                    { label: 'CTR Médio', value: formatPercent(ctr), icon: TrendingUp, color: 'ch-orange' },
                    { label: 'Investimento Real', value: formatCurrency(totalSpend), icon: DollarSign, color: 'emerald-500' },
                ].map((metric) => (
                    <motion.div key={metric.label} variants={item} whileHover={{ y: -3 }} className="bg-card border border-border shadow-sm rounded-3xl p-6 group">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 bg-${metric.color}/10 rounded-xl`}>
                                <metric.icon className={`w-4 h-4 text-${metric.color}`} />
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{metric.label}</span>
                        </div>
                        <p className="text-2xl font-bold text-foreground tracking-tighter tabular-nums group-hover:text-ch-orange transition-colors">{metric.value}</p>
                    </motion.div>
                ))}
            </div>

            <motion.p
                variants={item}
                className="text-[11px] text-muted-foreground leading-relaxed flex gap-2 items-start px-0.5 -mt-2"
            >
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70" aria-hidden />
                <span>
                    Os valores por anúncio seguem o filtro de datas (quando houver). Podem diferir levemente do investimento total do conjunto na Meta por atribuição e arredondamento.
                </span>
            </motion.p>
            </>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Side */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Active Creatives */}
                    <motion.div variants={item} className="glass rounded-[2rem] overflow-hidden border border-border shadow-2xl">
                        <div className="p-8 border-b border-border flex items-center justify-between bg-muted/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-ch-orange/10 rounded-xl">
                                    <Sparkles className="w-5 h-5 text-ch-orange" />
                                </div>
                                <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Ativos em Rotação ({creatives?.length || 0})</h2>
                            </div>
                        </div>
                        <div className="divide-y divide-border">
                            {creativeStats.map((creative: any) => (
                                <div key={creative.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-muted/10 transition-all group cursor-pointer" onClick={() => navigate(`/criativos/${creative.id}`)}>
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-background border border-border rounded-2xl overflow-hidden group-hover:border-ch-orange/30 transition-all shadow-lg shadow-black/10 dark:shadow-black/40">
                                            {creative.image_url ? (
                                                <img
                                                    src={getProxiedImageUrl(creative.image_url) || creative.image_url}
                                                    alt=""
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                        if (fallback) fallback.style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div className={`w-full h-full flex-col items-center justify-center gap-1 bg-muted/20 px-1 ${creative.image_url ? 'hidden' : 'flex'}`}>
                                                <Megaphone className="w-4 h-4 text-muted-foreground opacity-20" />
                                                <span className="text-[6px] font-bold text-red-500 leading-tight text-center">Sem permissão</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground group-hover:text-ch-orange transition-colors uppercase tracking-tight line-clamp-1">{cleanName(creative.name)}</p>
                                            <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-[0.15em] line-clamp-1">{creative.headline || 'Sem Headline Administrativa'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-10 mt-6 md:mt-0">
                                        {isBranding ? (
                                            (() => {
                                                const s = brandingCompliance?.byCreative.get(creative.id) ?? null;
                                                return (
                                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                                                        s === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                                        s === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                                        'bg-muted text-muted-foreground border border-border'
                                                    }`}>
                                                        {s === 'approved' ? <ShieldCheck className="w-3.5 h-3.5" /> :
                                                         s === 'rejected' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                                                         <ShieldCheck className="w-3.5 h-3.5 opacity-40" />}
                                                        {s === 'approved' ? 'Aprovado' : s === 'rejected' ? 'Reprovado' : 'Não analisado'}
                                                    </div>
                                                );
                                            })()
                                        ) : (
                                        <>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">CTR do Ativo</p>
                                            <p className="text-sm font-bold text-ch-orange tabular-nums">
                                                {creative.impressions > 0 ? ((creative.clicks / creative.impressions) * 100).toFixed(2) : 0}%
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Custo Médio</p>
                                            <p className="text-sm font-bold text-emerald-500 tabular-nums">
                                                {formatCurrency(creative.realSpend)}
                                            </p>
                                        </div>
                                        </>
                                        )}
                                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-ch-orange group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Sidebar Side */}
                <div className="space-y-8">
                    {!isBranding && adSetId && adSet && (
                        <EntityPerformanceAuditCard
                            entityId={adSetId}
                            entityName={adSet.name}
                            level="ad_set"
                            campaignId={campaignId}
                        />
                    )}
                    {/* Targeting Specs */}
                    <motion.div variants={item} className="bg-card border border-border shadow-sm rounded-[2.5rem] p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover:opacity-[0.08] transition-all duration-500">
                            <Globe className="w-48 h-48" />
                        </div>
                        <h2 className="text-lg font-bold text-foreground uppercase tracking-tight mb-8 flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-ch-orange rounded-full" /> Setup de Público
                        </h2>
                        {renderTargeting(adSet.targeting)}
                    </motion.div>

                    {/* Budget & Bid Side Card — performance only */}
                    {!isBranding && (
                    <motion.div variants={item} className="glass rounded-[2rem] p-8 border border-border relative overflow-hidden shadow-2xl">
                        <h2 className="text-sm font-bold text-foreground uppercase tracking-[0.2em] mb-8 border-l-2 border-ch-orange pl-4">Parâmetros Financeiros</h2>
                        <div className="space-y-8">
                            <div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Orçamento Atual</p>
                                <div className="flex items-center justify-between bg-muted/20 border border-border p-4 rounded-2xl group hover:border-emerald-500/30 transition-all">
                                    <span className="text-[10px] font-bold text-muted-foreground">DIÁRIO</span>
                                    <span className="text-xl font-bold text-foreground tabular-nums">
                                        {adSet.daily_budget ? formatCurrency(adSet.daily_budget) : '-'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border">
                                <div>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Estratégia</p>
                                    <p className="text-xs font-bold text-foreground uppercase tracking-tighter">
                                        {adSet.bid_strategy?.replace(/_/g, ' ') || 'MENOR CUSTO'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Janela Atrib.</p>
                                    <p className="text-xs font-bold text-foreground uppercase tracking-tighter">7 DIAS CLIQUE</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Meta de Otimização</p>
                                    <p className="text-xs font-bold text-foreground uppercase tracking-tighter">
                                        {(adSet as any).optimization_goal?.replace(/_/g, ' ') || 'CONVERSÃO'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    )}

                    {/* Information Node */}
                    <motion.div variants={item} className="glass rounded-[2rem] p-8 border border-border shadow-2xl">
                        <h2 className="text-sm font-bold text-foreground uppercase tracking-[0.2em] mb-6">Nódulo de Dados</h2>
                        <div className="space-y-4">
                            {[
                                { label: 'Status API', value: adSet.status, color: 'emerald-500' },
                                { label: 'Data de Início', value: adSet.start_time ? format(new Date(adSet.start_time), 'dd/MM/yyyy') : 'Contínuo', color: 'muted-foreground' },
                                { label: 'Duração', value: 'Vitalício', color: 'muted-foreground' },
                            ].map((row) => (
                                <div key={row.label} className="flex justify-between items-center py-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{row.label}</span>
                                    <span className={`text-[11px] font-bold text-${row.color} uppercase tracking-tight`}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Calibration Dialog — performance only */}
            {!isBranding && (
            <AnimatePresence>
                {isBudgetOpen && (
                    <Dialog open={isBudgetOpen} onOpenChange={setIsBudgetOpen}>
                        <DialogContent className="bg-popover border border-border shadow-2xl rounded-[2.5rem] p-8 max-w-lg">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold text-foreground uppercase tracking-tight">Calibração Financeira</DialogTitle>
                                <DialogDescription className="text-muted-foreground font-medium mt-2">
                                    Otimize os limites de gasto deste conjunto para melhorar o desempenho da IA.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-8 py-10">
                                <div className="space-y-4">
                                    <Label htmlFor="daily" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">INVESTIMENTO DIÁRIO (R$)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-ch-orange" />
                                        <Input
                                            id="daily"
                                            value={newDailyBudget}
                                            onChange={(e) => setNewDailyBudget(e.target.value)}
                                            className="bg-muted/40 border border-border text-foreground h-16 pl-14 font-bold tabular-nums text-xl focus:border-emerald-500/50 rounded-2xl transition-all"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <Label htmlFor="lifetime" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">INVESTIMENTO VITALÍCIO (R$)</Label>
                                    <div className="relative">
                                        <Activity className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                        <Input
                                            id="lifetime"
                                            value={newLifetimeBudget}
                                            onChange={(e) => setNewLifetimeBudget(e.target.value)}
                                            className="bg-muted/40 border border-border text-foreground h-16 pl-14 font-bold tabular-nums text-xl focus:border-blue-500/50 rounded-2xl transition-all"
                                            placeholder="NÃO DEFINIDO"
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="gap-4">
                                <Button variant="outline" onClick={() => setIsBudgetOpen(false)} className="rounded-2xl font-bold uppercase text-[11px] tracking-widest h-14 px-8 border border-border hover:bg-muted transition-all">Descartar</Button>
                                <Button onClick={handleUpdateBudget} disabled={adSetAction.isPending} className="bg-foreground text-background hover:bg-ch-orange font-bold uppercase text-[11px] tracking-widest px-10 rounded-2xl h-14 shadow-xl shadow-ch-orange/20 transition-all">
                                    {adSetAction.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar no Meta Ads'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>
            )}
        </motion.div>
    );
}
