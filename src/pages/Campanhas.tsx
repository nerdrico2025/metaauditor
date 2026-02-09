import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    ArrowUpDown,
    CheckCircle2,
    XCircle,
    PauseCircle,
    PlayCircle,
    Trash2,
    AlertCircle,
    Eye,
    MousePointer,
    DollarSign,
    Target,
    BarChart3,
    Megaphone,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    ChevronsLeft,
    ChevronsRight,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Zap, // Added Zap icon
    Sparkles, // Added Sparkles
    BrainCircuit // Added BrainCircuit
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';

// --- Interfaces ---
interface Campaign {
    id: string;
    name: string;
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    objective: string;
    daily_budget: number;
    start_time: string;
    insights?: {
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
        cpc: number;
        ctr: number;
        cpa: number;
        roas: number;
    };
    trends?: { // Added mock trends for UI
        spend: number;
        conversions: number;
    }
}

// --- Helper Functions ---
const getStatusBadge = (status: string) => {
    switch (status) {
        case 'ACTIVE':
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider shadow-sm">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Ativa
                </div>
            );
        case 'PAUSED':
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider shadow-sm">
                    <PauseCircle className="w-3 h-3" />
                    Pausada
                </div>
            );
        case 'ARCHIVED':
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ch-dark-gray border border-white/10 text-ch-text-muted text-[10px] font-black uppercase tracking-wider shadow-sm">
                    <Trash2 className="w-3 h-3" />
                    Arquivada
                </div>
            );
        default:
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ch-dark-gray border border-white/10 text-ch-text-dimmed text-[10px] font-black uppercase tracking-wider shadow-sm">
                    <AlertCircle className="w-3 h-3" />
                    {status}
                </div>
            );
    }
};

export default function Campanhas() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // --- State ---
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'spend', direction: 'desc' }); // Default sort by spend desc
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // --- Queries ---
    const { data: campaigns, isLoading, refetch } = useQuery({
        queryKey: ['campaigns', user?.company_id], // Add user?.company_id to key
        queryFn: async () => {
            if (!user?.company_id) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('campaigns')
                .select(`
                    *,
                    insights:campaign_daily_metrics(
                        spend,
                        impressions,
                        clicks,
                        conversions
                    )
                `)
                .eq('company_id', user.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Aggregating insights for the list view
            return data.map((campaign: any) => {
                const insights = campaign.insights?.reduce(
                    (acc: any, curr: any) => ({
                        spend: (Number(acc.spend) || 0) + (Number(curr.spend) || 0),
                        impressions: (Number(acc.impressions) || 0) + (Number(curr.impressions) || 0),
                        clicks: (Number(acc.clicks) || 0) + (Number(curr.clicks) || 0),
                        conversions: (Number(acc.conversions) || 0) + (Number(curr.conversions) || 0),
                    }),
                    { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
                ) || { spend: 0, impressions: 0, clicks: 0, conversions: 0 };


                return {
                    ...campaign,
                    insights: {
                        ...insights,
                        cpc: insights.clicks > 0 ? insights.spend / insights.clicks : 0,
                        ctr: insights.impressions > 0 ? (insights.clicks / insights.impressions) * 100 : 0,
                        cpa: insights.conversions > 0 ? insights.spend / insights.conversions : 0,
                        roas: 0, // Placeholder as revenue isn't in this simple view yet
                    },
                    trends: { // Mocking trends for demo
                        spend: Math.random() * 20 - 10,
                        conversions: Math.random() * 20 - 10
                    }
                };
            }) as Campaign[];
        },
        enabled: !!user?.company_id,
    });

    // --- Mutations ---
    const toggleStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: 'ACTIVE' | 'PAUSED' }) => {
            const { error } = await supabase
                .from('campaigns')
                .update({ status })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            toast.success('Status da campanha atualizado');
        },
        onError: () => toast.error('Falha ao atualizar status'),
    });

    // --- Filtering and Sorting Logic ---
    const filteredCampaigns = useMemo(() => {
        if (!campaigns) return [];
        let result = [...campaigns];

        if (search) {
            const lowerSearch = search.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(lowerSearch) ||
                c.id.toLowerCase().includes(lowerSearch)
            );
        }

        if (statusFilter !== 'all') {
            result = result.filter(c => c.status === statusFilter);
        }

        if (sortConfig) {
            result.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof Campaign];
                let bValue: any = b[sortConfig.key as keyof Campaign];

                // Handle nested insights sorting
                if (sortConfig.key.startsWith('insights.')) {
                    const key = sortConfig.key.split('.')[1] as keyof typeof a.insights;
                    aValue = a.insights?.[key] || 0;
                    bValue = b.insights?.[key] || 0;
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [campaigns, search, statusFilter, sortConfig]);

    // --- Pagination Logic ---
    const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);
    const paginatedCampaigns = filteredCampaigns.slice(
        (page - 1) * itemsPerPage,
        page * itemsPerPage
    );

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={container}
            className="p-8 space-y-8 min-h-screen pb-24"
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mr-1">
                <motion.div variants={item}>
                    <div className="flex items-center gap-3 mb-2">
                        <Megaphone className="w-5 h-5 text-ch-orange" />
                        <span className="text-[10px] font-bold text-ch-orange uppercase tracking-wider">Gestão de Tráfego</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <h1 className="text-4xl font-bold text-ch-white tracking-tight uppercase">Campanhas Ativas</h1>
                        <Badge variant="outline" className="bg-white/5 border-white/10 text-ch-text-dimmed h-7 px-3">
                            {filteredCampaigns.length} total
                        </Badge>
                    </div>
                    <p className="text-ch-text-dimmed font-medium mt-2 max-w-xl">
                        Gerencie, monitore e otimize suas campanhas de alta performance em um único painel de controle neural.
                    </p>
                </motion.div>

                <motion.div variants={item} className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => refetch()}
                        className="h-12 w-12 rounded-xl border-white/10 hover:bg-white/5 hover:text-ch-orange transition-colors"
                        disabled={isLoading}
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        onClick={() => navigate('/nova-campanha')}
                        className="h-12 px-6 bg-ch-orange text-ch-black hover:bg-ch-orange/90 font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-ch-orange/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Campanha
                    </Button>
                </motion.div>
            </div>

            {/* Filters & Toolbar */}
            <motion.div variants={item} className="glass p-2 rounded-2xl border-white/5 bg-white/[0.01] flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ch-text-dimmed" />
                    <Input
                        placeholder="Buscar por nome, ID ou objetivo..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-12 pl-11 bg-white/[0.02] border-transparent hover:bg-white/[0.04] focus:bg-ch-black-soft focus:border-ch-orange/30 rounded-xl transition-all text-ch-white placeholder:text-ch-text-muted/50 font-medium"
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px] h-12 bg-white/[0.02] border-transparent hover:bg-white/[0.04] rounded-xl text-ch-text-dimmed font-bold uppercase text-[10px] tracking-wide">
                            <div className="flex items-center gap-2">
                                <Filter className="w-3.5 h-3.5" />
                                <SelectValue placeholder="Status" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-ch-black-soft border-white/10">
                            <SelectItem value="all">Todos os Status</SelectItem>
                            <SelectItem value="ACTIVE">Ativas</SelectItem>
                            <SelectItem value="PAUSED">Pausadas</SelectItem>
                            <SelectItem value="ARCHIVED">Arquivadas</SelectItem>
                        </SelectContent>
                    </Select>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-12 px-4 border-transparent bg-white/[0.02] hover:bg-white/[0.04] text-ch-text-dimmed rounded-xl font-bold uppercase text-[10px] tracking-wide gap-2">
                                <ArrowUpDown className="w-3.5 h-3.5" />
                                Ordenar
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-ch-black-soft border-white/10 p-2">
                            <DropdownMenuLabel className="text-[9px] uppercase tracking-widest text-ch-text-muted px-2 py-1.5">Métricas Principais</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleSort('insights.spend')} className="flex items-center justify-between text-xs font-medium px-2 py-2 rounded-lg cursor-pointer hover:bg-white/5">
                                Investimento
                                {sortConfig?.key === 'insights.spend' && (sortConfig.direction === 'asc' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSort('insights.conversions')} className="flex items-center justify-between text-xs font-medium px-2 py-2 rounded-lg cursor-pointer hover:bg-white/5">
                                Conversões
                                {sortConfig?.key === 'insights.conversions' && (sortConfig.direction === 'asc' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSort('insights.ctr')} className="flex items-center justify-between text-xs font-medium px-2 py-2 rounded-lg cursor-pointer hover:bg-white/5">
                                CTR
                                {sortConfig?.key === 'insights.ctr' && (sortConfig.direction === 'asc' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </motion.div>

            {/* Neural Diagnostics Feature */}
            <motion.div
                variants={item}
                className="glass rounded-[2rem] p-8 border-white/5 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 relative overflow-hidden group"
            >
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000">
                    <BrainCircuit className="w-96 h-96" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                         <div className="flex items-center gap-2 mb-2">
                             <Sparkles className="w-4 h-4 text-purple-400" />
                             <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Neural Insights</span>
                         </div>
                         <h3 className="text-xl font-bold text-ch-white uppercase tracking-tight">Otimização de Portfólio</h3>
                         <p className="text-ch-text-dimmed text-sm mt-1 max-w-2xl">
                             Identificamos 3 campanhas com desempenho abaixo da média do setor. 
                             <span className="text-ch-white font-bold cursor-pointer hover:underline ml-1">Ver recomendações</span>
                         </p>
                    </div>
                    <Button size="sm" className="bg-white/10 hover:bg-white/20 text-ch-white border border-white/5 rounded-xl uppercase text-[10px] font-black tracking-widest px-6 h-10">
                        Executar Diagnóstico
                    </Button>
                </div>
            </motion.div>


            {/* Campaigns Table / Grid */}
            <motion.div variants={item} className="space-y-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="w-10 h-10 animate-spin text-ch-orange" />
                        <p className="text-xs font-bold text-ch-text-dimmed uppercase tracking-widest animate-pulse">Carregando dados da Matrix...</p>
                    </div>
                ) : filteredCampaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white/[0.02] rounded-[2rem] border border-dashed border-white/10">
                        <div className="w-20 h-20 bg-white/[0.02] rounded-full flex items-center justify-center mb-6">
                            <Search className="w-8 h-8 text-ch-text-muted opacity-50" />
                        </div>
                        <h3 className="text-lg font-bold text-ch-white uppercase tracking-tight">Nenhuma campanha encontrada</h3>
                        <p className="text-ch-text-dimmed text-sm mt-2 font-medium">Tente ajustar seus filtros ou crie uma nova campanha.</p>
                        <Button
                            variant="link"
                            className="text-ch-orange mt-4 uppercase text-xs font-bold tracking-widest"
                            onClick={() => { setSearch(''); setStatusFilter('all'); }}
                        >
                            Limpar Filtros
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 text-[9px] font-black text-ch-text-muted uppercase tracking-widest">
                            <div>Campanha</div>
                            <div className="text-right">Orçamento</div>
                            <div className="text-right">Investimento</div>
                            <div className="text-right">Resultados</div>
                            <div className="text-right">Custo/Res.</div>
                            <div className="text-right">ROAS</div>
                            <div className="w-10"></div>
                        </div>

                        {paginatedCampaigns.map((campaign) => (
                            <motion.div
                                key={campaign.id}
                                layoutId={campaign.id}
                                onClick={() => navigate(`/campanhas/${campaign.id}`)}
                                className="glass p-4 rounded-2xl border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition-all group cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-ch-orange opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center">
                                    {/* Campaign Info */}
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`p-3 rounded-xl transition-colors ${campaign.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20' : 'bg-white/5 text-ch-text-dimmed'}`}>
                                            <Megaphone className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-ch-white text-sm truncate group-hover:text-ch-orange transition-colors">{campaign.name}</h3>
                                                {getStatusBadge(campaign.status)}
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] font-medium text-ch-text-dimmed uppercase tracking-wide">
                                                <span className="flex items-center gap-1.5">
                                                    <Target className="w-3 h-3" />
                                                    {campaign.objective}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                                <span className="font-mono opacity-60">{campaign.id.slice(0, 8)}...</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Metrics for Desktop */}
                                    <div className="hidden md:block text-right">
                                        <p className="font-bold text-ch-white text-sm tabular-nums">{formatCurrency(Number(campaign.daily_budget))}</p>
                                        <p className="text-[9px] text-ch-text-dimmed uppercase tracking-wider">Diário</p>
                                    </div>
                                    <div className="hidden md:block text-right">
                                        <p className="font-bold text-ch-white text-sm tabular-nums">{formatCurrency(campaign.insights?.spend || 0)}</p>
                                        <div className={`flex items-center justify-end gap-1 text-[9px] font-bold ${campaign.trends?.spend > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {campaign.trends?.spend > 0 ? '+' : ''}{campaign.trends?.spend.toFixed(1)}%
                                        </div>
                                    </div>
                                    <div className="hidden md:block text-right">
                                        <p className="font-bold text-ch-white text-sm tabular-nums">{formatNumber(campaign.insights?.conversions || 0)}</p>
                                        <p className="text-[9px] text-ch-text-dimmed uppercase tracking-wider">Conv.</p>
                                    </div>
                                    <div className="hidden md:block text-right">
                                        <p className="font-bold text-ch-white text-sm tabular-nums">{formatCurrency(campaign.insights?.cpa || 0)}</p>
                                        <div className={`flex items-center justify-end gap-1 text-[9px] font-bold ${campaign.trends?.conversions > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                             {campaign.trends?.conversions > 0 ? '+' : ''}{campaign.trends?.conversions.toFixed(1)}%
                                        </div>
                                    </div>
                                     <div className="hidden md:block text-right">
                                        <p className="font-bold text-ch-white text-sm tabular-nums">{(campaign.insights?.roas || 0).toFixed(2)}x</p>
                                        <p className="text-[9px] text-ch-text-dimmed uppercase tracking-wider">Retorno</p>
                                    </div>

                                    {/* Action Menu */}
                                    <div className="flex justify-end onClick-stop-propagation" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-ch-text-dimmed hover:text-ch-white hover:bg-white/10 rounded-lg">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-ch-black-soft border-white/10 p-1">
                                                <DropdownMenuItem onClick={() => navigate(`/campanhas/${campaign.id}`)} className="cursor-pointer text-xs font-medium rounded-md hover:bg-white/5 focus:bg-white/5">
                                                    <Eye className="w-3.5 h-3.5 mr-2 text-ch-text-dimmed" />
                                                    Ver Detalhes
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => toggleStatusMutation.mutate({
                                                        id: campaign.id,
                                                        status: campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
                                                    })}
                                                    className="cursor-pointer text-xs font-medium rounded-md hover:bg-white/5 focus:bg-white/5"
                                                >
                                                    {campaign.status === 'ACTIVE' ? (
                                                        <>
                                                            <PauseCircle className="w-3.5 h-3.5 mr-2 text-amber-400" />
                                                            Pausar
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PlayCircle className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                                                            Ativar
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-white/5" />
                                                <DropdownMenuItem className="cursor-pointer text-xs font-medium rounded-md hover:bg-rose-500/10 focus:bg-rose-500/10 text-rose-400 focus:text-rose-400">
                                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                                    Arquivar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    
                                     {/* Mobile Metrics view could be added here for small screens */}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Pagination */}
            {filteredCampaigns.length > 0 && (
                <motion.div variants={item} className="flex items-center justify-between border-t border-white/5 pt-6">
                    <div className="text-[10px] font-bold text-ch-text-dimmed uppercase tracking-wider">
                        Mostrando {(page - 1) * itemsPerPage + 1} a {Math.min(page * itemsPerPage, filteredCampaigns.length)} de {filteredCampaigns.length}
                    </div>
                    <div className="flex items-center gap-2">
                         <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/5">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                className="h-8 w-8 rounded-lg hover:bg-white/5 disabled:opacity-30"
                            >
                                <ChevronsLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-8 w-8 rounded-lg hover:bg-white/5 disabled:opacity-30"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                        </div>
                        
                        <span className="text-xs font-black text-ch-white px-4">
                            Página {page} <span className="text-ch-text-dimmed font-medium">de {totalPages}</span>
                        </span>

                         <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/5">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="h-8 w-8 rounded-lg hover:bg-white/5 disabled:opacity-30"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                             <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPage(totalPages)}
                                disabled={page === totalPages}
                                className="h-8 w-8 rounded-lg hover:bg-white/5 disabled:opacity-30"
                            >
                                <ChevronsRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
