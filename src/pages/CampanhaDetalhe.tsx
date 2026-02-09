import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Calendar,
    Target,
    Users,
    DollarSign,
    MousePointer,
    Eye,
    BarChart3,
    MoreHorizontal,
    Play,
    Pause,
    Pencil,
    Trash2,
    Save, // Added Save icon
    X,
    MessageSquare, // Added MessageSquare icon
    CheckCircle2, // Added CheckCircle2
    AlertCircle, // Added AlertCircle
    Sparkles, // Added Sparkles
    Zap, // Added Zap
    BrainCircuit // Added BrainCircuit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion'; // Added Framer Motion

interface AdSet {
    id: string;
    name: string;
    status: string;
    daily_budget: number;
    billing_event: string;
    optimization_goal: string;
    start_time: string;
    targeting: any;
    insights?: {
        impressions: string; // Changed to string to match API response
        clicks: string;
        spend: string;
        cpc: string;
        ctr: string;
        conversions: string;
    };
    platform_status?: string; // Added platform_status
    effective_status?: string; // Added effective_status
}

interface Campaign {
    id: string;
    name: string;
    status: string;
    objective: string;
    daily_budget: number; // Changed to number
    lifetime_budget: number; // Changed to number
    start_time: string;
    buying_type: string;
    platforms: string[]; // Changed from platform: string
    special_ad_categories: string[];
    adsets?: AdSet[]; // Changed from ad_sets
    insights?: {
        impressions: string;
        clicks: string;
        spend: string;
        cpc: string;
        ctr: string;
        conversions: string;
    };
}

export default function CampanhaDetalhe() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [newBudget, setNewBudget] = useState('');
    const { user } = useAuth(); // Get user for company_id

    const { data: campaign, isLoading } = useQuery({
        queryKey: ['campaign', id],
        queryFn: async () => {
            if (!user?.company_id) throw new Error('Company ID not found');

            // Fetch campaign details with insights
            const { data, error } = await supabase
                .from('campaigns')
                .select(`
                    *,
                    adsets (*),
                    insights:campaign_daily_metrics(
                        impressions,
                        clicks,
                        spend,
                        cpc,
                        ctr,
                        conversions
                    )
                `)
                .eq('id', id)
                .eq('company_id', user.company_id)
                .single();

            if (error) throw error;

            // Aggregate insights (simplified for demo)
            const aggregatedInsights = data.insights?.reduce((acc: any, curr: any) => ({
                impressions: (Number(acc.impressions) || 0) + (Number(curr.impressions) || 0),
                clicks: (Number(acc.clicks) || 0) + (Number(curr.clicks) || 0),
                spend: (Number(acc.spend) || 0) + (Number(curr.spend) || 0),
                conversions: (Number(acc.conversions) || 0) + (Number(curr.conversions) || 0),
            }), { impressions: 0, clicks: 0, spend: 0, conversions: 0 });


            return {
                ...data,
                insights: aggregatedInsights ? {
                    ...aggregatedInsights,
                    cpc: aggregatedInsights.clicks > 0 ? aggregatedInsights.spend / aggregatedInsights.clicks : 0,
                    ctr: aggregatedInsights.impressions > 0 ? (aggregatedInsights.clicks / aggregatedInsights.impressions) * 100 : 0
                } : null
            } as Campaign;
        },
        enabled: !!id && !!user?.company_id,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const { error } = await supabase
                .from('campaigns')
                .update({ status })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaign', id] });
            toast.success('Status da campanha atualizado');
        },
        onError: () => {
            toast.error('Erro ao atualizar status');
        },
    });

    const updateBudgetMutation = useMutation({
        mutationFn: async ({ id, budget }: { id: string; budget: number }) => {
            const { error } = await supabase
                .from('campaigns')
                .update({ daily_budget: budget }) // Assuming daily_budget is what we edit
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaign', id] });
            toast.success('Orçamento atualizado');
            setIsEditingBudget(false);
        },
        onError: () => {
            toast.error('Erro ao atualizar orçamento');
        },
    });

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <h2 className="text-xl font-semibold">Campanha não encontrada</h2>
                <Button onClick={() => navigate('/campanhas')}>Voltar para Campanhas</Button>
            </div>
        );
    }

    const metrics = [
        {
            label: 'Investimento',
            value: formatCurrency(Number(campaign.insights?.spend || 0)),
            icon: DollarSign,
            trend: '+12.5%',
            trendUp: true,
        },
        {
            label: 'Impressões',
            value: Number(campaign.insights?.impressions || 0).toLocaleString(),
            icon: Eye,
            trend: '+8.2%',
            trendUp: true,
        },
        {
            label: 'Cliques',
            value: Number(campaign.insights?.clicks || 0).toLocaleString(),
            icon: MousePointer,
            trend: '-2.1%',
            trendUp: false,
        },
        {
            label: 'Conversões',
            value: Number(campaign.insights?.conversions || 0).toLocaleString(),
            icon: Target,
            trend: '+5.4%',
            trendUp: true,
        },
        {
            label: 'CTR',
            value: `${Number(campaign.insights?.ctr || 0).toFixed(2)}%`,
            icon: BarChart3,
            trend: '+1.2%',
            trendUp: true,
        },
        {
            label: 'CPC',
            value: formatCurrency(Number(campaign.insights?.cpc || 0)),
            icon: TrendingUp, // Or another appropriate icon
            trend: '-4.3%',
            trendUp: true, // Lower CPC is usually better
        },
    ];

    return (
        <div className="space-y-8 p-6 pb-20">
            {/* Header Area */}
            <div className="flex flex-col gap-6">
                <Button
                    variant="ghost"
                    className="w-fit text-ch-text-dimmed hover:text-ch-white hover:bg-white/5 -ml-2"
                    onClick={() => navigate('/campanhas')}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para Campanhas
                </Button>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Badge
                                className={
                                    campaign.status === 'ACTIVE'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-ch-dark-gray text-ch-text-muted border-white/10'
                                }
                            >
                                {campaign.status === 'ACTIVE' ? 'Ativa' : 'Pausada'}
                            </Badge>
                            <span className="text-[10px] font-black text-ch-text-dimmed uppercase tracking-widest">{campaign.id}</span>
                        </div>
                        <h1 className="text-3xl font-bold text-ch-white tracking-tight">{campaign.name}</h1>
                        <div className="flex items-center gap-6 text-[11px] font-medium text-ch-text-dimmed uppercase tracking-wide">
                            <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-ch-orange" />
                                {campaign.objective}
                            </div>
                            <div className="w-1 h-1 rounded-full bg-white/10" />
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-ch-orange" />
                                {new Date(campaign.start_time).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant={campaign.status === 'ACTIVE' ? 'destructive' : 'default'}
                            className={campaign.status === 'ACTIVE'
                                ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"
                            }
                            onClick={() => updateStatusMutation.mutate({
                                id: campaign.id,
                                status: campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
                            })}
                        >
                            {campaign.status === 'ACTIVE' ? (
                                <>
                                    <Pause className="w-4 h-4 mr-2" /> Pausar Campanha
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 mr-2" /> Ativar Campanha
                                </>
                            )}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="border-white/10 bg-white/5 hover:bg-white/10 text-ch-white">
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-ch-black-soft border-white/10">
                                <DropdownMenuItem className="text-ch-text-dimmed focus:text-ch-white focus:bg-white/5 cursor-pointer">
                                    <Pencil className="w-4 h-4 mr-2" /> Editar Configurações
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-rose-400 focus:text-rose-300 focus:bg-rose-500/10 cursor-pointer">
                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir Campanha
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Neural Diagnostics Panel (New Feature) */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-[2rem] p-8 border-white/5 relative overflow-hidden group bg-gradient-to-br from-ch-black-soft via-transparent to-ch-orange/5"
            >
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity duration-1000">
                    <BrainCircuit className="w-64 h-64 text-ch-orange" />
                </div>
                
                <div className="flex flex-col md:flex-row gap-8 relative z-10">
                    {/* Score Ring */}
                    <div className="flex flex-col items-center justify-center space-y-4 min-w-[200px]">
                         <div className="relative w-32 h-32 flex items-center justify-center">
                            {/* Simple SVG Ring for demo */}
                            <svg className="w-full h-full -rotate-90">
                                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="351.86" strokeDashoffset="70" className="text-emerald-500" strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-ch-white">82</span>
                                <span className="text-[9px] font-bold text-ch-text-dimmed uppercase tracking-wider">Health Score</span>
                            </div>
                         </div>
                         <Badge variant="outline" className="bg-emerald-500/5 text-emerald-400 border-emerald-500/20 font-bold tracking-wide">
                            <Sparkles className="w-3 h-3 mr-1.5" /> Otimização Ativa
                         </Badge>
                    </div>

                    {/* Insights List */}
                    <div className="flex-1 space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-ch-white flex items-center gap-2">
                                <Zap className="w-5 h-5 text-ch-orange" />
                                Diagnóstico Neural
                            </h3>
                            <p className="text-ch-text-dimmed text-sm mt-1">Nossa IA analisou 2.4k pontos de dados e identificou oportunidades.</p>
                        </div>
                        
                        <div className="grid gap-3">
                             <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex gap-4 items-start">
                                <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-ch-white">Estrutura de Campanha Otimizada</h4>
                                    <p className="text-xs text-ch-text-dimmed mt-1">A distribuição de orçamento entre conjuntos de anúncios está ideal.</p>
                                </div>
                             </div>
                             
                             <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-4 items-start">
                                <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                                    <AlertCircle className="w-4 h-4 text-amber-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-ch-white">Fadiga de Criativo Detectada</h4>
                                    <p className="text-xs text-ch-text-dimmed mt-1">2 anúncios no Conjunto B estão com frequência acima de 4.0. Considere rotacionar.</p>
                                </div>
                                <Button size="sm" variant="ghost" className="ml-auto text-amber-400 hover:text-amber-300 hover:bg-amber-500/10">Ver</Button>
                             </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {metrics.map((metric) => (
                    <motion.div
                        key={metric.label}
                        whileHover={{ y: -5 }}
                        className="glass p-5 rounded-2xl border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-ch-text-dimmed uppercase tracking-wider">{metric.label}</span>
                            <metric.icon className="w-4 h-4 text-ch-orange/50 group-hover:text-ch-orange transition-colors" />
                        </div>
                        <p className="text-2xl font-bold text-ch-white tracking-tight tabular-nums">{metric.value}</p>
                        <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${metric.trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {metric.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {metric.trend}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="adsets" className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl w-full sm:w-auto h-auto grid grid-cols-2 sm:flex sm:inline-flex mb-8">
                    <TabsTrigger value="adsets" className="rounded-lg data-[state=active]:bg-ch-orange data-[state=active]:text-ch-black text-ch-text-dimmed uppercase text-[10px] font-black tracking-widest px-6 py-2.5">
                        Conjuntos de Anúncios
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-ch-orange data-[state=active]:text-ch-black text-ch-text-dimmed uppercase text-[10px] font-black tracking-widest px-6 py-2.5">
                        Configurações
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="adsets" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-ch-white uppercase tracking-tight">Estrutura de Conjuntos</h2>
                        <Button className="bg-ch-orange text-ch-black hover:bg-ch-orange/90 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                            Novo Conjunto
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {campaign.adsets?.map((adset) => (
                            <div
                                key={adset.id}
                                onClick={() => navigate(`/adsets/${adset.id}`)}
                                className="glass p-5 rounded-2xl border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all group cursor-pointer border-l-4 border-l-transparent hover:border-l-ch-orange"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white/5 rounded-xl group-hover:bg-ch-orange/10 transition-colors">
                                            <Users className="w-5 h-5 text-ch-text-dimmed group-hover:text-ch-orange transition-colors" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-ch-white text-base mb-1">{adset.name}</h3>
                                            <div className="flex items-center gap-3 text-[10px] font-medium text-ch-text-dimmed uppercase tracking-wide">
                                                <span className={adset.status === 'ACTIVE' ? 'text-emerald-400' : 'text-ch-text-muted'}>
                                                    {adset.status}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                                <span>{formatCurrency(Number(adset.daily_budget))} / dia</span>
                                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                                <span>{adset.optimization_goal}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="grid grid-cols-3 gap-8 text-right">
                                            <div>
                                                <p className="text-[9px] font-bold text-ch-text-dimmed uppercase tracking-wider mb-1">Resultados</p>
                                                <p className="font-bold text-ch-white tabular-nums">{Number(adset.insights?.conversions || 0)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-ch-text-dimmed uppercase tracking-wider mb-1">Custo/Res.</p>
                                                <p className="font-bold text-ch-white tabular-nums">
                                                    {formatCurrency(
                                                        (Number(adset.insights?.spend || 0) / (Number(adset.insights?.conversions || 1))) || 0
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-ch-text-dimmed uppercase tracking-wider mb-1">Gasto</p>
                                                <p className="font-bold text-ch-white tabular-nums">{formatCurrency(Number(adset.insights?.spend || 0))}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-ch-text-dimmed opacity-0 group-hover:opacity-100 transition-opacity -ml-2" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="glass p-8 rounded-[2rem] border-white/5 bg-white/[0.01] max-w-2xl">
                         <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-ch-orange/10 rounded-xl">
                                <DollarSign className="w-6 h-6 text-ch-orange" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-ch-white uppercase tracking-tight">Configurações de Orçamento</h3>
                                <p className="text-xs text-ch-text-dimmed font-medium mt-1">Gerencie o investimento diário desta campanha</p>
                            </div>
                         </div>
                         
                         <div className="space-y-8">
                            <div className="bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-bold text-ch-text-dimmed uppercase tracking-wide">Orçamento Diário Atual</span>
                                    <span className="text-2xl font-black text-ch-white tracking-tight">{formatCurrency(Number(campaign.daily_budget))}</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-ch-orange/50 to-ch-orange w-[70%] rounded-full" />
                                </div>
                                <p className="text-[10px] text-ch-text-dimmed mt-3 text-right">70% do limite de gastos da conta</p>
                            </div>
                            
                            <div className="flex items-end gap-4">
                                <div className="flex-1 space-y-3">
                                    <label className="text-xs font-bold text-ch-white uppercase tracking-wider">Novo Limite Diário</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ch-text-dimmed font-bold">R$</span>
                                        <Input
                                            type="number"
                                            placeholder="0,00"
                                            className="pl-12 bg-white/5 border-white/10 text-ch-white font-bold h-12 rounded-xl focus:border-ch-orange/50 transition-colors"
                                            defaultValue={Number(campaign.daily_budget)}
                                            onChange={(e) => setNewBudget(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Button 
                                    className="h-12 px-8 bg-ch-white text-ch-black hover:bg-ch-white/90 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all hover:scale-105 active:scale-95"
                                    onClick={() => {
                                      if (newBudget) {
                                          updateBudgetMutation.mutate({ id: campaign.id, budget: parseFloat(newBudget) });
                                      }
                                    }}
                                >
                                    Atualizar Orçamento
                                </Button>
                            </div>
                         </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Helper component for icon import (if needed) or remove if unused icons are cleaned up
import { ChevronRight } from 'lucide-react';
