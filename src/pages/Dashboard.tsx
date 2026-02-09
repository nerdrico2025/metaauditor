import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyMetrics, MetricsPeriod } from '@/hooks/useCompanyMetrics';
import { useActiveCampaignsCount } from '@/hooks/useCampaigns';
import { useCreativesCount } from '@/hooks/useCreatives';
import { useAuditsCount, useRecentAudits, useIssuesWithHighPriority } from '@/hooks/useAudits';
import { useAccountHealth } from '@/hooks/useAccountHealth';
import {
    TrendingUp,
    TrendingDown,
    Users,
    Megaphone,
    FileCheck,
    ArrowUpRight,
    ArrowDownRight,
    BarChart3,
    DollarSign,
    MousePointer,
    Eye,
    Target,
    AlertTriangle,
    Check,
    Loader2,
    RefreshCw,
    Sparkles,
    Activity,
    ShieldAlert,
    Zap,
    Award,
    Briefcase,
    ShieldCheck,
    ChevronRight,
    ArrowRight
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PerformanceChart from '@/components/PerformanceChart';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { motion, AnimatePresence } from 'framer-motion';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString('pt-BR');
};

const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
};

const getVariation = (current: number, previous: number): { value: number; trend: 'up' | 'down' | 'neutral' } => {
    if (previous === 0) return { value: 0, trend: 'neutral' };
    const variation = ((current - previous) / previous) * 100;
    return {
        value: Math.abs(variation),
        trend: variation > 0 ? 'up' : variation < 0 ? 'down' : 'neutral',
    };
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

export default function Dashboard() {
    const { user } = useAuth();
    const [period, setPeriod] = useState<MetricsPeriod>('7d');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [isCustomDate, setIsCustomDate] = useState(false);

    const effectivePeriod = isCustomDate && dateRange?.from && dateRange?.to
        ? { from: dateRange.from, to: dateRange.to }
        : period;

    const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useCompanyMetrics(effectivePeriod);
    const { data: activeCampaigns } = useActiveCampaignsCount();
    const { data: creativesCount } = useCreativesCount();
    const { data: auditsCount } = useAuditsCount();
    const { data: recentAudits } = useRecentAudits(3);
    const { data: highPriorityIssues } = useIssuesWithHighPriority(3);
    const { data: accountHealth } = useAccountHealth();

    const hasData = metrics && (metrics.totalImpressions > 0 || metrics.totalSpend > 0);


    // Calculate System Health Score
    const systemHealthParams = {
        maxScore: 100,
        highPriorityPenalty: 20,
        integrationPenalty: 50,
    };

    let healthScore = systemHealthParams.maxScore;
    if (accountHealth?.integrationStatus !== 'connected') {
        healthScore -= systemHealthParams.integrationPenalty;
    }
    if (highPriorityIssues) {
        healthScore -= (highPriorityIssues.length * systemHealthParams.highPriorityPenalty);
    }
    healthScore = Math.max(0, healthScore); // Ensure non-negative

    const metricCards = metrics ? [
        {
            title: 'IMPRESSÕES',
            value: formatNumber(metrics.totalImpressions),
            variation: getVariation(metrics.totalImpressions, metrics.previousPeriod.totalImpressions),
            icon: Eye,
            color: 'emerald-400',
        },
        {
            title: 'CLIQUES',
            value: formatNumber(metrics.totalClicks),
            variation: getVariation(metrics.totalClicks, metrics.previousPeriod.totalClicks),
            icon: MousePointer,
            color: 'blue-400',
        },
        {
            title: 'CPC',
            value: formatCurrency(metrics.avgCpc),
            variation: getVariation(metrics.avgCpc, metrics.previousPeriod.avgCpc),
            invertTrend: true,
            icon: DollarSign,
            color: 'indigo-400',
        },
        {
            title: 'CONVERSAS',
            value: formatNumber(metrics.totalConversions),
            variation: getVariation(metrics.totalConversions, metrics.previousPeriod.totalConversions),
            icon: Check, // Ideally MessageSquare or similar if available, keeping Check for now or switching if imported
            color: 'amber-400',
        },
        {
            title: 'CPL',
            value: formatCurrency(metrics.globalCpa),
            variation: getVariation(metrics.globalCpa, metrics.previousPeriod.globalCpa),
            invertTrend: true,
            icon: Target,
            color: 'teal-400',
        },
        {
            title: 'INVESTIMENTO TOTAL',
            value: formatCurrency(metrics.totalSpend),
            variation: getVariation(metrics.totalSpend, metrics.previousPeriod.totalSpend),
            invertTrend: true,
            icon: TrendingUp,
            color: 'ch-orange',
        },
    ] : [];

    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={container}
            className="p-6 space-y-10"
        >
            {/* Command Central Header */}
            <motion.div
                variants={item}
                className="flex flex-col md:flex-row md:items-center justify-between gap-8"
            >
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Sparkles className="w-4 h-4 text-ch-orange" />
                        <span className="text-[10px] font-bold text-ch-orange uppercase tracking-wide">Centro de Comando Neural</span>
                    </div>
                    <h1 className="text-4xl font-bold text-ch-white tracking-tight uppercase">
                        Bem-vindo, {user?.first_name || 'Operador'}
                    </h1>
                    <p className="text-ch-text-dimmed font-medium mt-1">
                        Sincronização em tempo real com seu ecossistema <span className="text-ch-white font-bold">Click.Hero</span>
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white/[0.02] p-2 rounded-2xl border border-white/5 backdrop-blur-sm shadow-xl">
                    {!isCustomDate ? (
                        <Select
                            value={period as string}
                            onValueChange={(v) => {
                                if (v === 'custom') {
                                    setIsCustomDate(true);
                                } else {
                                    setPeriod(v as MetricsPeriod);
                                }
                            }}
                        >
                            <SelectTrigger className="w-48 h-12 bg-transparent border-none font-black text-[10px] uppercase tracking-wide focus:ring-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-ch-black-soft border-white/10 font-black uppercase text-[10px]">
                                <SelectItem value="7d">Operação 7 Dias</SelectItem>
                                <SelectItem value="14d">Operação 14 Dias</SelectItem>
                                <SelectItem value="30d">Ciclo Mensal</SelectItem>
                                <SelectItem value="90d">Trimestre Estratégico</SelectItem>
                                <SelectItem value="custom">Período Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="flex items-center gap-2">
                            <DatePickerWithRange
                                className="border-none"
                                date={dateRange}
                                onDateChange={setDateRange}
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsCustomDate(false)}
                                className="h-8 w-8 p-0"
                            >
                                X
                            </Button>
                        </div>
                    )}
                    <div className="h-8 w-px bg-white/5" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => refetchMetrics()}
                        className="h-12 w-12 hover:bg-ch-orange/10 hover:text-ch-orange transition-all duration-300 rounded-xl"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </Button>
                </div>
            </motion.div>

            {/* Neural Insights / Alerts */}
            <AnimatePresence>
                {accountHealth?.alerts && accountHealth.alerts.length > 0 && (
                    <motion.div
                        variants={item}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                        {accountHealth.alerts.map((alert, i) => (
                            <div
                                key={i}
                                className={`p-5 rounded-[1.5rem] flex items-center gap-5 border backdrop-blur-xl shadow-2xl overflow-hidden relative group ${alert.type === 'error' ? 'bg-rose-500/5 border-rose-500/20 text-rose-400' :
                                    alert.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' :
                                        'bg-ch-orange/5 border-ch-orange/20 text-ch-orange'
                                    }`}
                            >
                                <div className={`p-3 rounded-2xl ${alert.type === 'error' ? 'bg-rose-500/10' :
                                    alert.type === 'warning' ? 'bg-amber-500/10' :
                                        'bg-ch-orange/10'
                                    } group-hover:scale-110 transition-transform`}>
                                    <ShieldAlert className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-40 mb-1">ALERTA DO SISTEMA</p>
                                    <p className="text-sm font-bold tracking-tight uppercase">{alert.message}</p>
                                </div>
                                <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] rotate-12">
                                    <ShieldAlert className="w-24 h-24" />
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Primary Metrics Layer */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    {
                        title: 'ESTRUTURA ATIVA',
                        value: activeCampaigns?.toString() || '0',
                        sub: 'CAMPANHAS EM OTIMIZAÇÃO',
                        icon: Megaphone,
                        color: 'ch-orange'
                    },
                    {
                        title: 'ATIVOS CRIATIVOS',
                        value: creativesCount?.toString() || '0',
                        sub: 'BANCO DE DADOS ATUALIZADO',
                        icon: BarChart3,
                        color: 'blue-400'
                    },
                    {
                        title: 'QUALIDADE DO SISTEMA',
                        value: `${healthScore}%`,
                        sub: 'SISTEMA OPERACIONAL',
                        icon: ShieldCheck,
                        color: 'indigo-400'
                    },
                    {
                        title: 'WORKSPACE',
                        value: user?.company?.name?.toUpperCase() || 'MINHA EMPRESA',
                        sub: user?.company?.subscription_plan ? `PLANO ${user.company.subscription_plan.toUpperCase()}` : 'PLANO STARTER',
                        icon: Briefcase,
                        color: 'emerald-400'
                    },
                ].map((stat) => (
                    <motion.div
                        key={stat.title}
                        variants={item}
                        whileHover={{ y: -5 }}
                        className="glass-card rounded-[2.5rem] p-8 border-white/5 relative overflow-hidden group shadow-2xl bg-white/[0.01]"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.08] transition-opacity pointer-events-none transform translate-x-4">
                            <stat.icon className="w-24 h-24" />
                        </div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className={`p-2.5 bg-${stat.color}/10 rounded-xl`}>
                                <stat.icon className={`w-5 h-5 text-${stat.color}`} />
                            </div>
                            <span className="text-[10px] font-bold text-ch-text-dimmed uppercase tracking-[.2em] leading-none">{stat.title}</span>
                        </div>
                        <p className={`font-bold text-ch-white tracking-tighter tabular-nums group-hover:text-ch-orange transition-colors duration-500 ${stat.title === 'WORKSPACE' ? 'text-xl line-clamp-1' : 'text-4xl'}`}>
                            {stat.value}
                        </p>
                        <div className="mt-6 flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full bg-${stat.color} animate-pulse`} />
                            <p className="text-[9px] font-bold text-ch-text-muted uppercase tracking-widest">{stat.sub}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Performance Engine Grid */}
            <div className="space-y-6">
                <motion.div variants={item} className="flex items-center gap-3 ml-1">
                    <Activity className="w-4 h-4 text-ch-orange" />
                    <h2 className="text-[11px] font-black text-ch-white uppercase tracking-widest">Matriz de Performance em Tempo Real</h2>
                </motion.div>

                {metricsLoading ? (
                    <div className="glass rounded-[2rem] p-32 flex flex-col items-center justify-center gap-6 border-white/5 shadow-inner bg-white/[0.01]">
                        <div className="relative">
                            <RefreshCw className="w-16 h-16 animate-spin text-ch-orange opacity-20" />
                            <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-ch-orange" />
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-ch-orange mb-2">Sincronizando Camadas de Dados</p>
                            <p className="text-ch-text-dimmed font-medium uppercase text-[9px] tracking-widest">Acessando API Graph v18.0 do Meta...</p>
                        </div>
                    </div>
                ) : hasData ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
                        {metricCards.map((metric, idx) => {
                            const isPositive = metric.invertTrend
                                ? metric.variation.trend === 'down'
                                : metric.variation.trend === 'up';

                            return (
                                <motion.div
                                    key={metric.title}
                                    variants={item}
                                    whileHover={{ y: -5 }}
                                    className="glass rounded-3xl p-6 border-white/5 hover:border-white/10 transition-all shadow-xl flex flex-col h-40 bg-white/[0.02]"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div className={`w-1.5 h-1.5 rounded-full bg-${metric.color}`} />
                                            <span className="text-[9px] font-bold text-ch-text-dimmed uppercase tracking-normal leading-tight whitespace-nowrap">{metric.title}</span>
                                        </div>
                                        <p className="text-2xl font-bold text-ch-white tracking-tight tabular-nums">{metric.value}</p>
                                    </div>

                                    {metric.variation.value > 0 && (
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest w-fit shadow-lg ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                            }`}>
                                            {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                            {metric.variation.value.toFixed(1)}%
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <motion.div variants={item} className="glass rounded-[2rem] p-24 text-center border-white/5 shadow-2xl bg-white/[0.01]">
                        <div className="w-24 h-24 bg-ch-orange/5 border border-ch-orange/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
                            <BarChart3 className="w-10 h-10 text-ch-orange animate-pulse" />
                        </div>
                        <h3 className="text-2xl font-bold text-ch-white mb-3 uppercase tracking-tight">Perda de Sinal Detectada</h3>
                        <p className="text-ch-text-dimmed font-medium max-w-sm mx-auto uppercase text-[9px] tracking-widest leading-relaxed">
                            Nenhum fluxo analítico detectado para o workspace selecionado no ciclo {typeof period === 'string' ? period : 'Personalizado'}.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-10 bg-ch-dark-gray/40 border-white/5 hover:bg-white/5 text-ch-orange font-black uppercase text-[11px] tracking-widest h-14 px-10 rounded-2xl transition-all"
                            onClick={() => window.location.href = '/integracoes'}
                        >
                            Reconectar Base de Sinais
                        </Button>
                    </motion.div>
                )}
            </div>

            {/* Neural Chart Layer */}
            {
                hasData && metrics?.dailyData && (
                    <motion.div variants={item} className="glass rounded-[3rem] p-10 border-white/5 shadow-2xl overflow-hidden relative group bg-white/[0.01]">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none transform translate-x-1/4 -translate-y-1/4 blur-2xl group-hover:opacity-[0.05] transition-opacity duration-1000">
                            <TrendingUp className="w-[600px] h-[600px]" />
                        </div>
                        <div className="flex flex-col md:flex-row items-center justify-between mb-12 relative z-10 gap-8">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <Zap className="w-5 h-5 text-ch-orange" />
                                    <span className="text-[10px] font-bold text-ch-orange uppercase tracking-wider">Curva de Performance</span>
                                </div>
                                <h2 className="text-3xl font-bold text-ch-white tracking-tight uppercase">Analítica de Fluxo Neural</h2>
                                <p className="text-[10px] text-ch-text-dimmed font-bold uppercase tracking-widest mt-2">Mapeamento temporal de engajamento e conversão de rede</p>
                            </div>
                            <div className="flex items-center gap-10">
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black text-ch-text-dimmed uppercase tracking-wide mb-1.5 opacity-40">Gasto Acumulado</span>
                                    <span className="text-3xl font-black text-emerald-400 tabular-nums leading-none">{formatCurrency(metrics.totalSpend)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-[450px] relative z-10">
                            <PerformanceChart />
                        </div>
                    </motion.div>
                )
            }

            {/* Tactical Feed Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
                <motion.div variants={item} className="glass rounded-[2.5rem] p-10 border-white/5 shadow-2xl bg-white/[0.01] flex flex-col overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.01] pointer-events-none">
                        <Award className="w-64 h-64" />
                    </div>
                    <div className="flex items-center justify-between mb-10 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-ch-orange/10 rounded-2xl">
                                <TrendingUp className="w-5 h-5 text-ch-orange" />
                            </div>
                            <div>
                                <h2 className="font-black text-ch-white uppercase tracking-tight text-lg">Auditoria de Performance IA</h2>
                                <p className="text-[9px] font-black text-ch-text-muted uppercase tracking-widest mt-1">Últimas validações de conformidade</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-12 w-12 hover:bg-white/10 rounded-2xl transition-all" onClick={() => window.location.href = '/auditorias'}>
                            <ArrowRight className="w-6 h-6 text-ch-text-muted hover:text-ch-orange" />
                        </Button>
                    </div>

                    <div className="space-y-4 relative z-10 flex-1">
                        {recentAudits && recentAudits.length > 0 ? (
                            recentAudits.map((audit) => (
                                <div key={audit.id} className="flex items-center justify-between p-5 rounded-[1.8rem] hover:bg-white/[0.03] border border-white/5 transition-all group cursor-pointer">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-ch-black border border-white/10 rounded-2xl overflow-hidden shadow-2xl group-hover:scale-105 transition-transform duration-700">
                                            {audit.creative?.image_url ? (
                                                <img src={audit.creative.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Target className="w-6 h-6 text-ch-text-dimmed opacity-20" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-base font-black text-ch-white group-hover:text-ch-orange transition-colors line-clamp-1 uppercase tracking-tight">{audit.creative?.name || 'ASSET_PROBE_' + audit.id.slice(0, 4)}</p>
                                            <p className="text-[10px] text-ch-text-muted font-black mt-2 uppercase tracking-widest flex items-center gap-2">
                                                <RefreshCw className="w-3 h-3 text-ch-orange" />
                                                VERIFICADO {formatDistanceToNow(new Date(audit.created_at), { addSuffix: true, locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-[1.3rem] border-2 transition-all group-hover:rotate-6 ${audit.compliance_score >= 80 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' :
                                        audit.compliance_score >= 50 ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' :
                                            'bg-rose-500/5 border-rose-500/20 text-rose-400'
                                        }`}>
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">Score</span>
                                        <span className="text-xl font-black tabular-nums">{audit.compliance_score}%</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-24 text-center flex flex-col items-center flex-1 justify-center">
                                <Activity className="w-12 h-12 text-ch-text-dimmed mb-6 opacity-10 animate-pulse" />
                                <p className="text-[10px] text-ch-text-muted font-black uppercase tracking-[0.3em]">Aguardando Fluxo de Auditoria</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                <motion.div variants={item} className="glass rounded-[2.5rem] p-10 border-white/5 shadow-2xl bg-white/[0.01] flex flex-col overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.01] pointer-events-none">
                        <AlertTriangle className="w-64 h-64" />
                    </div>
                    <div className="flex items-center justify-between mb-10 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-500/10 rounded-2xl">
                                <FileCheck className="w-5 h-5 text-rose-500" />
                            </div>
                            <div>
                                <h2 className="font-black text-ch-white uppercase tracking-tight text-lg">Riscos do Ecossistema</h2>
                                <p className="text-[9px] font-black text-ch-text-muted uppercase tracking-widest mt-1">Violações Críticas de Performance/Identidade</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 relative z-10 flex-1">
                        {highPriorityIssues && highPriorityIssues.length > 0 ? (
                            highPriorityIssues.map((issue) => (
                                <div key={issue.id} className="flex items-center justify-between p-6 rounded-[1.8rem] bg-rose-500/[0.03] border border-rose-500/10 hover:border-rose-500/40 transition-all group cursor-pointer shadow-xl">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-105 group-hover:rotate-3 transition-transform duration-500">
                                            <AlertTriangle className="w-8 h-8 text-rose-500 group-hover:animate-bounce" />
                                        </div>
                                        <div>
                                            <p className="text-base font-black text-ch-white line-clamp-1 uppercase tracking-tight">{issue.creative?.name || 'CONFORMITY_BREACH'}</p>
                                            <div className="flex items-center gap-2.5 mt-2">
                                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                                <p className="text-[10px] text-rose-500/90 font-black uppercase tracking-[0.2em]">AÇÃO IMEDIATA NECESSÁRIA</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center justify-center w-20 h-20 rounded-[1.3rem] border-2 bg-rose-500/20 border-rose-500/30 text-rose-500 shadow-2xl skew-x-[-2deg]">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Estado</span>
                                        <span className="text-xs font-black tracking-widest">CRÍTICO</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-24 text-center flex flex-col items-center flex-1 justify-center">
                                <div className="w-20 h-20 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 flex items-center justify-center mb-8 shadow-2xl">
                                    <Check className="w-8 h-8 text-emerald-500" />
                                </div>
                                <h4 className="text-lg font-black text-ch-white uppercase tracking-tight">Full Compliance Matrix</h4>
                                <p className="text-[10px] text-ch-text-dimmed mt-3 font-black uppercase tracking-[.3em]">Zero anomalias detectadas no ecossistema.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div >
    );
}
