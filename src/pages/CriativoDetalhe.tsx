import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getProxiedImageUrl, formatCurrency, formatNumber } from '@/lib/utils';
import { CreativeCompliancePreview, ComplianceOverlayLayer } from '@/components/branding/CreativeCompliancePreview';
import { CreativeMediaPreview } from '@/components/branding/CreativeMediaPreview';
import { useCreativeRuleCheck, useCreativeRules } from '@/hooks/useCreativeRules';
import { useModule } from '@/contexts/ModuleContext';
import { evaluatePerformanceRules, isAdLevelPerformanceRule } from '@/lib/performanceRules';
import { useCampaignAction } from '@/hooks/useCampaignAction';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    Image,
    Play,
    Loader2,
    Eye,
    MousePointerClick,
    TrendingUp,
    DollarSign,
    Target,
    BarChart3,
    Film,
    FileImage,
    ExternalLink,
    AlertTriangle,
    CheckCircle,
    Clock,
    MoreVertical,
    Pause,
    Zap,
    Sparkles,
    ShieldCheck,
    Type,
    Award,
    Trash2,
    Activity,
    ChevronRight,
    BrainCircuit,
    History,
    SearchCheck,
    Dna,
    PauseCircle,
    Wallet,
    Database,
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
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CreativeAuditReportDialog } from '@/components/audits/CreativeAuditReportDialog';
import { auditFocusLabel, primaryAuditScore, resolveAuditFocus, type AuditFocus } from '@/lib/audit-focus';
import { isActiveCampaignStatus } from '@/lib/creativeScope';
import { friendlyEdgeFunctionError, parseSupabaseFunctionError } from '@/lib/edgeFunctionErrors';

const formatPercent = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00%';
    return `${value.toFixed(2)}%`;
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

export default function CriativoDetalhe() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/criativos';
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const companyId = user?.company?.id;

    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [auditSequence, setAuditSequence] = useState<string>('');
    const [auditStepIndex, setAuditStepIndex] = useState(0);
    const [auditTotalSteps, setAuditTotalSteps] = useState(0);
    const [selectedAudit, setSelectedAudit] = useState<any>(null);
    const [isAuditDetailsOpen, setIsAuditDetailsOpen] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const [freshVideoUrl, setFreshVideoUrl] = useState<string | null>(null);
    const [previewIframe, setPreviewIframe] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [imageZoomOpen, setImageZoomOpen] = useState(false);
    const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);
    const [analyzeAI, setAnalyzeAI] = useState(true);
    const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
    const [selectedPerfRuleIds, setSelectedPerfRuleIds] = useState<Set<string>>(new Set());
    const [lastRulesCheck, setLastRulesCheck] = useState<any>(null);
    const [lastPerfResults, setLastPerfResults] = useState<Array<{ rule_name: string; passed: boolean; reason: string }> | null>(null);
    const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
    const [newBudgetValue, setNewBudgetValue] = useState('');

    const campaignAction = useCampaignAction();

    const { module } = useModule();
    const isBranding = module === 'branding';

    // Check creative rules compliance for red border
    const { lastCheck: ruleCheck, runCheck } = useCreativeRuleCheck(id || null);
    const { rules: creativeRules } = useCreativeRules();
    const isRuleRejected = ruleCheck?.overall_status === 'rejected';
    const isRuleWarning = ruleCheck?.overall_status === 'warning';
    const isRuleNonCompliant = isRuleRejected || isRuleWarning;
    const ruleFailedRules = (ruleCheck?.results || [])
        .filter(r => !r.passed)
        .map(r => ({ rule_name: r.rule_name, severity: r.severity, reason: r.reason }));

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
        enabled: !!companyId,
    });

    const { data: creative, isLoading } = useQuery({
        queryKey: ['creative', id],
        queryFn: async () => {
            if (!id) throw new Error('No creative ID');

            const { data, error } = await supabase
                .from('creatives')
                .select('*, campaigns(id, name, status, external_id, daily_budget, integration_id)')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // Auto-fetch fresh video URL or preview when video fails or is missing
    const fetchFreshPreview = async () => {
        if (!id || loadingPreview) return;
        setLoadingPreview(true);
        try {
            const { data, error } = await supabase.functions.invoke('meta-ad-preview', {
                body: { creative_id: id },
            });

            console.log('meta-ad-preview response:', { data, error });

            if (error) {
                console.error('Edge function error:', error);
                return;
            }

            if (data) {
                if (data.video_url) {
                    setFreshVideoUrl(data.video_url);
                    setVideoError(false);
                } else if (data.preview_iframe) {
                    setPreviewIframe(data.preview_iframe);
                }
            }
        } catch (e) {
            console.error('Failed to fetch preview:', e);
        } finally {
            setLoadingPreview(false);
        }
    };

    // Auto-fetch fresh video when video fails or is missing
    useEffect(() => {
        if (creative?.type === 'video' && (videoError || !creative?.video_url) && !loadingPreview && !freshVideoUrl && !previewIframe) {
            fetchFreshPreview();
        }
    }, [creative?.type, creative?.video_url, videoError]);

    const { data: audits } = useQuery({
        queryKey: ['creative-audits', id, module],
        queryFn: async () => {
            if (!id) throw new Error('No creative ID');

            const { data, error } = await supabase
                .from('audits')
                .select('*')
                .eq('creative_id', id)
                .eq('audit_focus', module)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) {
                // Fallback before migration: filter client-side
                const { data: all, error: allErr } = await supabase
                    .from('audits')
                    .select('*')
                    .eq('creative_id', id)
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (allErr) throw allErr;
                return (all ?? []).filter(a => resolveAuditFocus(a) === module).slice(0, 5);
            }
            return data || [];
        },
        enabled: !!id,
    });

    const latestModuleAudit = audits?.[0];

    const aiAuditAction = useMutation({
        mutationFn: async ({
            ruleIds,
            forceRefresh,
        }: { ruleIds?: string[]; forceRefresh?: boolean } = {}) => {
            const campaignStatus = (creative as { campaigns?: { status?: string } } | undefined)?.campaigns?.status;
            if (!isActiveCampaignStatus(campaignStatus)) {
                throw new Error('Campanha pausada — análise disponível apenas para campanhas ativas');
            }

            setIsAnalyzing(true);

            const steps = isBranding
                ? [
                    'Agente de Visão analisando identidade visual',
                    'Agente de Branding verificando conformidade',
                    'Agente de Copy avaliando tom e guidelines',
                    ...(ruleIds && ruleIds.length > 0 ? ['Agente de Regras verificando branding'] : []),
                    'Compilando relatório de branding',
                ]
                : [
                    'Agente de Visão analisando hook e composição',
                    'Agente de Performance cruzando métricas',
                    'Agente de Marketing avaliando persuasão e conversão',
                    'Compilando relatório de performance',
                ];

            setAuditTotalSteps(steps.length);
            setAuditStepIndex(0);

            let cancelled = false;
            const stepPromise = (async () => {
                for (let i = 0; i < steps.length; i++) {
                    if (cancelled) return;
                    setAuditStepIndex(i);
                    setAuditSequence(steps[i]);
                    await new Promise((r) => setTimeout(r, 2500));
                }
            })();

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                cancelled = true;
                throw new Error('Sem sessão ativa');
            }
            const headers = { Authorization: `Bearer ${session.access_token}` };

            const auditPromise = supabase.functions.invoke('audit-creative', {
                body: {
                    creative_id: id,
                    audit_focus: module,
                    rule_ids: isBranding && ruleIds?.length ? ruleIds : undefined,
                    force_refresh: forceRefresh ?? false,
                },
                headers,
            });

            let rulesPromise: Promise<any> | null = null;
            if (isBranding && ruleIds && ruleIds.length > 0 && id) {
                rulesPromise = supabase.functions.invoke('check-creative-rules', {
                    body: { creative_id: id, rule_ids: ruleIds },
                    headers,
                });
            }

            let auditResponse: Awaited<typeof auditPromise>;
            let rulesResponse: any = null;
            try {
                [auditResponse, rulesResponse] = await Promise.all([
                    auditPromise,
                    rulesPromise || Promise.resolve(null),
                ]);
            } finally {
                cancelled = true;
            }

            void stepPromise;

            if (auditResponse.error || !auditResponse.data?.success) {
                const detail = await parseSupabaseFunctionError(auditResponse.error, auditResponse.data);
                throw new Error(friendlyEdgeFunctionError(detail, 'Falha na análise do criativo.'));
            }

            if (isBranding && ruleIds && ruleIds.length > 0 && rulesResponse) {
                if (rulesResponse.error || !rulesResponse.data?.success) {
                    const rulesDetail = await parseSupabaseFunctionError(
                        rulesResponse.error,
                        rulesResponse.data,
                    );
                    throw new Error(
                        friendlyEdgeFunctionError(
                            rulesDetail,
                            'Falha na verificação das regras de branding.',
                        ),
                    );
                }
            }

            // If rules check ran, attach results to the audit for display
            let rulesCheckResult = null;
            if (rulesResponse?.data?.success && rulesResponse.data.check) {
                rulesCheckResult = rulesResponse.data.check;
            }

            // Fetch the saved audit
            const { data: newAudit } = await supabase
                .from('audits')
                .select('*')
                .eq('id', auditResponse.data.audit_id)
                .single();

            return { audit: newAudit, rulesCheck: rulesCheckResult };
        },
        onSuccess: (result) => {
            setIsAnalyzing(false);
            setAuditSequence('');

            const ai = result?.audit?.ai_analysis;
            const incomplete = !!ai?.error;

            if (incomplete) {
                toast.warning('Análise parcial concluída', {
                    description: 'Análise salva com base nas regras configuradas. Veja o resumo ou use Reanalise para insights de marketing.',
                    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
                });
            } else {
                toast.success('Diagnóstico Multi-Agente Concluído!', {
                    description: 'Time de agentes IA analisou o criativo com sucesso.',
                    icon: <BrainCircuit className="w-5 h-5 text-ch-orange" />,
                });
            }

            if (result?.audit) {
                setSelectedAudit(result.audit);
                setLastRulesCheck(result.rulesCheck || null);
                setLastPerfResults(
                    isBranding ? null : (result.audit?.ai_analysis?.performance_rules_compliance ?? null),
                );
                setIsAuditDetailsOpen(true);
            }

            queryClient.invalidateQueries({ queryKey: ['creative-audits', id] });
            queryClient.invalidateQueries({ queryKey: ['creative', id] });
            queryClient.invalidateQueries({ queryKey: ['creative-rule-check', id] });
            queryClient.invalidateQueries({ queryKey: ['creative-rule-checks-batch'] });
            if (companyId) {
                queryClient.invalidateQueries({ queryKey: ['click-hero-recommendations', companyId] });
            }
        },
        onError: (error) => {
            setIsAnalyzing(false);
            setAuditSequence('');
            const message = error instanceof Error ? error.message : String(error);
            toast.error(friendlyEdgeFunctionError(message, 'Falha no processo neural. Tente novamente.'));
        }
    });

    const adAction = useMutation({
        mutationFn: async ({ action }: { action: string }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-ad-action`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    creative_id: id,
                    action,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to perform action');
            }

            return response.json();
        },
        onSuccess: (data, variables) => {
            if (variables.action === 'preview' && data.preview_content) {
                setPreviewContent(data.preview_content);
                setIsPreviewOpen(true);
            } else {
                toast.success(`Ação ${variables.action} realizada com sucesso`);
                queryClient.invalidateQueries({ queryKey: ['creative', id] });
            }
        },
        onError: (error) => {
            toast.error(`Erro: ${error.message}`);
        }
    });

    const getTypeIcon = (type: string | null) => {
        switch (type) {
            case 'video':
                return <Film className="w-5 h-5" />;
            case 'image':
                return <FileImage className="w-5 h-5" />;
            default:
                return <Image className="w-5 h-5" />;
        }
    };

    const getTypeBadge = (type: string | null) => {
        const config: Record<string, { label: string, color: string, icon: any }> = {
            video: { label: 'Vídeo Performance', color: 'ch-blue', icon: Film },
            image: { label: 'Imagem Estática', color: 'blue-500', icon: FileImage },
            carousel: { label: 'Carrossel', color: 'emerald-500', icon: Target },
        };
        const cfg = config[type || ''] || { label: 'Anúncio', color: 'ch-text-dimmed', icon: Image };
        const Icon = cfg.icon;

        // Handle custom theme colors that don't follow tailwind's 500/10 convention
        const colorBase = cfg.color === 'ch-blue' || cfg.color === 'ch-orange' ? cfg.color : `${cfg.color}`;
        const textColorClass = cfg.color === 'ch-blue' ? 'text-[#0ea5e9]' : cfg.color === 'ch-orange' ? 'text-ch-orange' : `text-${cfg.color}`;
        const bgColorClass = cfg.color === 'ch-blue' ? 'bg-[#0ea5e9]/10' : cfg.color === 'ch-orange' ? 'bg-ch-orange/10' : `bg-${cfg.color}/10`;
        const borderColorClass = cfg.color === 'ch-blue' ? 'border-[#0ea5e9]/20' : cfg.color === 'ch-orange' ? 'border-ch-orange/20' : `border-${cfg.color}/20`;

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold ${bgColorClass} ${textColorClass} border ${borderColorClass} shadow-sm`}>
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
            </span>
        );
    };

    const getAuditStatusBadge = (status: string) => {
        const config: Record<string, { label: string, color: string, icon: any }> = {
            approved: { label: 'Aprovado', color: 'emerald-500', icon: CheckCircle },
            rejected: { label: 'Rejeitado', color: 'rose-500', icon: AlertTriangle },
            pending: { label: 'Análise Pendente', color: 'amber-500', icon: Clock },
        };
        const cfg = config[status] || config.pending;
        const Icon = cfg.icon;

        const colorClasses: Record<string, string> = {
            'emerald-500': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
            'rose-500': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
            'amber-500': 'bg-amber-500/10 text-amber-500 border-amber-500/20'
        };

        return (
            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5 ${colorClasses[cfg.color] || colorClasses['amber-500']} border shadow-sm`}>
                <Icon className="w-3 h-3" />
                {cfg.label}
            </span>
        );
    };

    // Auto-evaluate performance rules against this creative's metrics
    const ctr = creative?.ctr ? Number(creative.ctr) : 0;
    const cpc = creative?.cpc ? Number(creative.cpc) : 0;
    const spend = creative ? (Number(creative.spend) || (creative.clicks || 0) * cpc) : 0;
    const cpa = creative?.conversions && creative.conversions > 0 ? spend / creative.conversions : 0;

    const perfViolations = useMemo(() => {
        if (!performanceRules?.length || !creative) {
            return { violations: [] as Array<{ rule_name: string; metric: string; current: number; operator: string; threshold: number; action_type?: string }>, violatedMetrics: new Set<string>() };
        }
        const adLevelRules = performanceRules.filter(isAdLevelPerformanceRule);
        const violations = evaluatePerformanceRules(adLevelRules, creative);
        const violatedMetrics = new Set(violations.map(v => v.metric));
        return { violations, violatedMetrics };
    }, [performanceRules, creative]);

    const hasPerfViolations = perfViolations.violations.length > 0;

    // Map metric label to metric key for card highlighting
    const metricLabelToKey: Record<string, string> = {
        'Gasto no Ativo': 'spend',
        'Alcance Global': 'impressions',
        'Cliques Únicos': 'clicks',
        'CTR do Ativo': 'ctr',
        'Custo p/ Clique': 'cpc',
        'Resultado': 'conversions',
    };

    if (isLoading || !creative) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[500px] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-ch-orange opacity-40" />
                <p className="text-xs font-medium text-muted-foreground">Escaneando ativos visuais...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={container}
            className="p-6 space-y-8"
        >
            {/* Header */}
            <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(returnTo)}
                        className="h-12 w-12 bg-muted border border-border hover:bg-ch-orange/10 hover:text-ch-orange transition-all duration-300 rounded-2xl group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <Sparkles className="w-4 h-4 text-ch-orange" />
                            <span className="text-xs font-medium text-ch-orange">Visão do Ativo IA</span>
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">
                            {creative.name
                                .replace(/[_-]/g, ' ')
                                .replace(/\.(mp4|jpg|png|jpeg|mov|gif|webp)$/i, '')
                                .replace(/([a-z])([A-Z])/g, '$1 $2')
                                .trim()
                                .replace(/\b\w/g, c => c.toUpperCase())
                                .replace(/^(Img|Video|Carrossel)\s+/i, '')}
                        </h1>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs font-medium text-muted-foreground">ID: {creative.external_id}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-xs font-semibold text-muted-foreground">{creative.campaigns?.name || 'Vago'}</span>
                        </div>
                    </div>

                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => {
                            if (isAnalyzing) return;
                            // Pre-select all active rules
                            const activeIds = (creativeRules || []).filter(r => r.is_active).map(r => r.id);
                            setSelectedRuleIds(new Set(activeIds));
                            setSelectedPerfRuleIds(new Set((performanceRules || []).map(r => r.id)));
                            setAnalyzeAI(true);
                            setIsAnalysisPanelOpen(true);
                        }}
                        disabled={isAnalyzing}
                        className="relative overflow-hidden bg-gradient-to-r from-ch-orange to-ch-orange-hover hover:shadow-sm text-white font-bold rounded-xl transition-all h-12 px-8 group border-none"
                    >
                        <AnimatePresence mode="wait">
                            {isAnalyzing ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex items-center gap-2"
                                >
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-[10px] uppercase tracking-tighter w-40 truncate">{auditSequence}</span>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="idle"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex items-center gap-2"
                                >
                                    <BrainCircuit className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span className="text-base">Análise Profissional IA</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Button>

                    {/* Analysis Panel Dialog */}
                    <Dialog open={isAnalysisPanelOpen} onOpenChange={setIsAnalysisPanelOpen}>
                        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <BrainCircuit className="w-5 h-5 text-ch-orange" />
                                    Análise Profissional IA
                                </DialogTitle>
                                <DialogDescription>
                                    Selecione o que deseja analisar neste criativo: diagnóstico IA e/ou regras ativas.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 mt-2">
                                {/* AI Analysis option */}
                                <label className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                                    <Checkbox
                                        checked={analyzeAI}
                                        onCheckedChange={(v) => setAnalyzeAI(!!v)}
                                        className="mt-0.5"
                                    />
                                    <div>
                                        <span className="font-semibold text-sm flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-ch-orange" />
                                            Análise de IA
                                        </span>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {isBranding
                                                ? 'Diagnóstico de branding: conformidade visual, regras criativas e guidelines de marca.'
                                                : 'Diagnóstico de performance: métricas, persuasão, conversão e regras de automação.'}
                                        </p>
                                    </div>
                                </label>

                                {/* Rules section — branding only */}
                                {isBranding && (() => {
                                    const activeRules = (creativeRules || []).filter(r => r.is_active);
                                    if (activeRules.length === 0) return null;
                                    const allSelected = activeRules.every(r => selectedRuleIds.has(r.id));
                                    const someSelected = activeRules.some(r => selectedRuleIds.has(r.id));
                                    return (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-1">
                                                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                                    Regras de Criativo ({activeRules.length})
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (allSelected) {
                                                            setSelectedRuleIds(new Set());
                                                        } else {
                                                            setSelectedRuleIds(new Set(activeRules.map(r => r.id)));
                                                        }
                                                    }}
                                                    className="text-[11px] font-medium text-ch-orange hover:underline"
                                                >
                                                    {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                                                </button>
                                            </div>
                                            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                                                {activeRules.map(rule => (
                                                    <label
                                                        key={rule.id}
                                                        className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                                                    >
                                                        <Checkbox
                                                            checked={selectedRuleIds.has(rule.id)}
                                                            onCheckedChange={(v) => {
                                                                setSelectedRuleIds(prev => {
                                                                    const next = new Set(prev);
                                                                    if (v) next.add(rule.id);
                                                                    else next.delete(rule.id);
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-sm font-medium block truncate">{rule.name}</span>
                                                            {rule.description && (
                                                                <span className="text-[11px] text-muted-foreground block truncate">{rule.description}</span>
                                                            )}
                                                        </div>
                                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                                            rule.rule_type === 'visual'
                                                                ? 'bg-purple-500/10 text-purple-500'
                                                                : rule.rule_type === 'content'
                                                                    ? 'bg-blue-500/10 text-blue-500'
                                                                    : rule.rule_type === 'copy'
                                                                        ? 'bg-amber-500/10 text-amber-500'
                                                                        : 'bg-emerald-500/10 text-emerald-500'
                                                        }`}>
                                                            {rule.rule_type === 'visual' ? 'Visual' : rule.rule_type === 'content' ? 'Conteúdo' : rule.rule_type === 'copy' ? 'Copy' : 'Estrutura'}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Performance Rules section — performance only */}
                                {!isBranding && (() => {
                                    const activePerfRules = performanceRules || [];
                                    if (activePerfRules.length === 0) return null;
                                    const allPerfSelected = activePerfRules.every((r: any) => selectedPerfRuleIds.has(r.id));
                                    return (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-1">
                                                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                                    <Activity className="w-3.5 h-3.5 text-amber-500" />
                                                    Regras de Performance ({activePerfRules.length})
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (allPerfSelected) {
                                                            setSelectedPerfRuleIds(new Set());
                                                        } else {
                                                            setSelectedPerfRuleIds(new Set(activePerfRules.map((r: any) => r.id)));
                                                        }
                                                    }}
                                                    className="text-[11px] font-medium text-ch-orange hover:underline"
                                                >
                                                    {allPerfSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                                                </button>
                                            </div>
                                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                {activePerfRules.map((rule: any) => {
                                                    const cond = rule.trigger_conditions;
                                                    const opLabel = cond?.operator === 'less_than' ? '<' : cond?.operator === 'greater_than' ? '>' : cond?.operator === 'equal' ? '=' : cond?.operator;
                                                    const metricLabel = cond?.metric?.toUpperCase() || '';
                                                    return (
                                                        <label
                                                            key={rule.id}
                                                            className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                                                        >
                                                            <Checkbox
                                                                checked={selectedPerfRuleIds.has(rule.id)}
                                                                onCheckedChange={(v) => {
                                                                    setSelectedPerfRuleIds(prev => {
                                                                        const next = new Set(prev);
                                                                        if (v) next.add(rule.id);
                                                                        else next.delete(rule.id);
                                                                        return next;
                                                                    });
                                                                }}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-sm font-medium block truncate">{rule.name}</span>
                                                                <span className="text-[11px] text-muted-foreground block truncate">
                                                                    {metricLabel} {opLabel} {cond?.threshold}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                                                                Métrica
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="outline" onClick={() => setIsAnalysisPanelOpen(false)} className="rounded-xl">
                                    Cancelar
                                </Button>
                                <Button
                                    disabled={
                                        !analyzeAI &&
                                        (isBranding ? selectedRuleIds.size === 0 : selectedPerfRuleIds.size === 0)
                                    }
                                    onClick={async () => {
                                        setIsAnalysisPanelOpen(false);

                                        if (!isBranding && selectedPerfRuleIds.size > 0 && creative) {
                                            const perfResults: Array<{ rule_name: string; passed: boolean; reason: string }> = [];
                                            for (const perfRule of (performanceRules || [])) {
                                                if (!selectedPerfRuleIds.has(perfRule.id)) continue;
                                                const cond = perfRule.trigger_conditions;
                                                const metricValue = Number((creative as any)[cond.metric]) || 0;
                                                const threshold = Number(cond.threshold);
                                                let triggered = false;
                                                if (cond.operator === 'lt' || cond.operator === 'less_than') triggered = metricValue < threshold;
                                                else if (cond.operator === 'lte') triggered = metricValue <= threshold;
                                                else if (cond.operator === 'gt' || cond.operator === 'greater_than') triggered = metricValue > threshold;
                                                else if (cond.operator === 'gte') triggered = metricValue >= threshold;
                                                else if (cond.operator === 'equal') triggered = metricValue === threshold;

                                                const isMonetary = cond.metric === 'cpc' || cond.metric === 'spend';
                                                const isPercent = cond.metric === 'ctr';
                                                const fmtVal = isMonetary ? `R$ ${metricValue.toFixed(2)}` : isPercent ? `${metricValue.toFixed(2)}%` : String(Math.round(metricValue));
                                                const fmtThresh = isMonetary ? `R$ ${threshold}` : isPercent ? `${threshold}%` : String(threshold);
                                                const opSymbol = cond.operator === 'lt' || cond.operator === 'less_than' ? '<' : cond.operator === 'lte' ? '≤' : cond.operator === 'gt' || cond.operator === 'greater_than' ? '>' : cond.operator === 'gte' ? '≥' : '=';

                                                perfResults.push({
                                                    rule_name: perfRule.name,
                                                    passed: !triggered,
                                                    reason: triggered
                                                        ? `${cond.metric.toUpperCase()} atual: ${fmtVal} — viola regra (limite: ${opSymbol} ${fmtThresh})`
                                                        : `${cond.metric.toUpperCase()} OK: ${fmtVal} (limite: ${opSymbol} ${fmtThresh})`,
                                                });
                                            }
                                            setLastPerfResults(perfResults);
                                        } else if (!isBranding) {
                                            setLastPerfResults(null);
                                        }

                                        if (analyzeAI) {
                                            aiAuditAction.mutate({
                                                ruleIds: isBranding && selectedRuleIds.size > 0
                                                    ? Array.from(selectedRuleIds)
                                                    : undefined,
                                            });
                                        } else if (isBranding && selectedRuleIds.size > 0 && id) {
                                            runCheck.mutate({ creative_id: id, rule_ids: Array.from(selectedRuleIds) });
                                        }
                                    }}
                                    className="bg-gradient-to-r from-ch-orange to-ch-orange-hover text-white font-bold rounded-xl px-6 border-none"
                                >
                                    <BrainCircuit className="w-4 h-4 mr-2" />
                                    Iniciar Análise
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border border-border hover:bg-muted">
                                <MoreVertical className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border w-56">
                            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Gestão de Status</DropdownMenuLabel>
                            {creative.status === 'active' ? (
                                <DropdownMenuItem onClick={() => adAction.mutate({ action: 'pause' })} className="py-3 cursor-pointer">
                                    <Pause className="mr-3 h-4 w-4 text-amber-500" /> <span className="font-bold">Interromper Veiculação</span>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onClick={() => adAction.mutate({ action: 'activate' })} className="py-3 cursor-pointer">
                                    <Play className="mr-3 h-4 w-4 text-emerald-500" /> <span className="font-bold">Retomar Veiculação</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem onClick={() => adAction.mutate({ action: 'preview' })} className="py-3 cursor-pointer">
                                <Eye className="mr-3 h-4 w-4 text-blue-400" /> Gerar Preview Real
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem className="py-3 text-rose-500 opacity-50 cursor-not-allowed">
                                <Trash2 className="mr-3 h-4 w-4" /> Remover Ativo
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {creative.video_url && (
                        <Button
                            variant="outline"
                            onClick={() => window.open(creative.video_url!, '_blank')}
                            className="bg-muted border border-border h-12 px-6 rounded-xl font-semibold text-xs"
                        >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Origem
                        </Button>
                    )}
                </div>
            </motion.div>

            {/* Rule Violation Alert Banner */}
            {isBranding && isRuleRejected && (
                <motion.div variants={item} className="flex items-center gap-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                    <AlertTriangle className="w-6 h-6 text-rose-500 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-rose-500">Criativo reprovado em branding</p>
                        <p className="text-xs text-rose-400/80">Não está em conformidade com as regras de branding. Score: {ruleCheck?.overall_score}/100</p>
                    </div>
                </motion.div>
            )}

            {isBranding && isRuleWarning && !isRuleRejected && (
                <motion.div variants={item} className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-amber-500">Atenção — branding com ressalvas</p>
                        <p className="text-xs text-amber-400/80">Score de branding: {ruleCheck?.overall_score}/100</p>
                    </div>
                </motion.div>
            )}

            {/* Performance Rule Violations Banner */}
            {!isBranding && hasPerfViolations && (
                <motion.div variants={item} className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-rose-500 flex-shrink-0" />
                        <p className="text-sm font-bold text-rose-500">
                            {perfViolations.violations.length} regra(s) de performance violada(s)
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

            {/* Latest Analysis Summary - cached results */}
            {audits && audits.length > 0 && (() => {
                const latest = audits[0];
                const latestScore = latest.compliance_score || latest.score || 0;
                const latestAnalysis = latest.ai_analysis;
                const isLatestApproved = latest.status === 'approved';
                const timeAgo = (() => {
                    const diff = Date.now() - new Date(latest.created_at).getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 1) return 'agora mesmo';
                    if (mins < 60) return `há ${mins} min`;
                    const hours = Math.floor(mins / 60);
                    if (hours < 24) return `há ${hours}h`;
                    const days = Math.floor(hours / 24);
                    return `há ${days}d`;
                })();

                return (
                    <motion.div
                        variants={item}
                        className={`rounded-2xl border p-5 cursor-pointer hover:shadow-lg transition-all ${
                            isLatestApproved
                                ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                                : 'bg-ch-orange/5 border-ch-orange/20 hover:border-ch-orange/40'
                        }`}
                        onClick={() => {
                            setSelectedAudit(latest);
                            setLastRulesCheck(null);
                            setIsAuditDetailsOpen(true);
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${isLatestApproved ? 'bg-emerald-500/10' : 'bg-ch-orange/10'}`}>
                                    <BrainCircuit className={`w-5 h-5 ${isLatestApproved ? 'text-emerald-500' : 'text-ch-orange'}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                        Última Análise IA
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                            isLatestApproved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-ch-orange/10 text-ch-orange'
                                        }`}>
                                            Score {latestScore}%
                                        </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                        <Clock className="w-3 h-3" />
                                        {timeAgo} — {format(new Date(latest.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {isBranding && ruleCheck && (
                                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                                        ruleCheck.overall_status === 'approved'
                                            ? 'bg-emerald-500/10 text-emerald-500'
                                            : ruleCheck.overall_status === 'rejected'
                                                ? 'bg-rose-500/10 text-rose-500'
                                                : 'bg-amber-500/10 text-amber-500'
                                    }`}>
                                        <ShieldCheck className="w-3 h-3" />
                                        Regras: {ruleCheck.overall_score}/100
                                    </span>
                                )}
                                <span className="text-xs font-medium text-ch-orange flex items-center gap-1">
                                    Ver relatório <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                            </div>
                        </div>
                        {latestAnalysis?.tone_analysis && (
                            <p className="text-xs text-muted-foreground mt-3 line-clamp-2 pl-12">
                                {latestAnalysis.tone_analysis}
                            </p>
                        )}
                    </motion.div>
                );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Preview Side */}
                <motion.div variants={item} className="lg:col-span-1 space-y-6">
                    <div className={`bg-card rounded-[2.5rem] overflow-hidden shadow-sm group ${
                        isBranding && isRuleRejected
                            ? 'border-2 border-rose-500 ring-2 ring-rose-500/20'
                            : isBranding && isRuleWarning
                                ? 'border-2 border-amber-500 ring-2 ring-amber-500/20'
                                : !isBranding && hasPerfViolations
                                    ? 'border-2 border-rose-500 ring-2 ring-rose-500/20'
                                    : 'border border-border'
                    }`}>
                        <div className="aspect-video max-h-[360px] bg-muted relative overflow-hidden">
                            {/* Video with fresh URL from preview API */}
                            {creative.type === 'video' && freshVideoUrl ? (
                                <video
                                    src={freshVideoUrl}
                                    poster={getProxiedImageUrl(creative.image_url, creative.external_id) || undefined}
                                    controls
                                    className="w-full h-full object-cover"
                                    playsInline
                                    onError={() => {
                                        setFreshVideoUrl(null);
                                        setVideoError(true);
                                    }}
                                />
                            ) : creative.type === 'video' && creative.video_url && !videoError ? (
                                <video
                                    src={creative.video_url}
                                    poster={getProxiedImageUrl(creative.image_url, creative.external_id) || undefined}
                                    controls
                                    className="w-full h-full object-cover"
                                    playsInline
                                    onError={() => {
                                        setVideoError(true);
                                        fetchFreshPreview();
                                    }}
                                />
                            ) : creative.type === 'video' && previewIframe ? (
                                <div
                                    className="w-full h-full flex items-center justify-center bg-black"
                                    dangerouslySetInnerHTML={{ __html: previewIframe.replace(/width="\d+"/, 'width="100%"').replace(/height="\d+"/, 'height="100%"') }}
                                />
                            ) : creative.type === 'video' && (videoError || !creative.video_url) ? (
                                <div className="relative w-full h-full">
                                    {creative.image_url ? (
                                        <img
                                            src={getProxiedImageUrl(creative.image_url, creative.external_id) || creative.image_url}
                                            alt={creative.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : null}
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                                        {loadingPreview ? (
                                            <>
                                                <Loader2 className="w-10 h-10 text-ch-orange animate-spin" />
                                                <p className="text-xs text-white/80 font-medium">Buscando vídeo atualizado...</p>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-12 h-12 text-white/40" />
                                                <p className="text-xs text-white/80 font-medium text-center px-6">
                                                    Vídeo não disponível.
                                                </p>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); fetchFreshPreview(); }}
                                                    className="mt-2 px-4 py-2 bg-ch-orange/90 hover:bg-ch-orange text-black text-xs font-bold rounded-xl transition-colors"
                                                >
                                                    Atualizar Vídeo
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : creative.image_url ? (
                                <div
                                    className="w-full h-full cursor-zoom-in"
                                    onClick={() => setImageZoomOpen(true)}
                                    onKeyDown={(e) => e.key === 'Enter' && setImageZoomOpen(true)}
                                    role="button"
                                    tabIndex={0}
                                >
                                    {isBranding ? (
                                    <CreativeCompliancePreview
                                        imageUrl={creative.image_url}
                                        externalId={creative.external_id}
                                        name={creative.name}
                                        status={ruleCheck?.overall_status ?? 'approved'}
                                        failedRules={ruleFailedRules}
                                        fit="contain"
                                        aspectClassName="h-full w-full"
                                        className="h-full w-full rounded-none"
                                    />
                                    ) : (
                                    <CreativeMediaPreview
                                        imageUrl={creative.image_url}
                                        externalId={creative.external_id}
                                        name={creative.name}
                                        fit="contain"
                                        fill
                                        roundedClassName="rounded-none"
                                    />
                                    )}
                                </div>
                            ) : null}
                            {isBranding && isRuleNonCompliant && creative.type === 'video' && (
                                <ComplianceOverlayLayer
                                    status={ruleCheck?.overall_status ?? 'rejected'}
                                    failedRules={ruleFailedRules}
                                />
                            )}
                            <div className={`w-full h-full flex-col items-center justify-center gap-5 text-muted-foreground bg-muted/20 fallback-no-preview ${creative.image_url ? 'hidden' : 'flex'}`}>
                                {getTypeIcon(creative.type)}
                                <div className="flex flex-col items-center gap-2 max-w-xs">
                                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                                        <span className="text-xs font-semibold text-red-500 leading-tight">Resolução baixa por falta de permissão do administrador na conta de anúncios</span>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute top-6 right-6">
                                {getTypeBadge(creative.type)}
                            </div>
                        </div>

                        <div className="p-8 space-y-8 relative bg-card rounded-b-[2.5rem] border-t border-border">
                            {creative.headline && (
                                <div className="relative">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Type className="w-3 h-3 text-ch-orange" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chamada de Ação</span>
                                    </div>
                                    <p className="text-xl font-bold text-foreground leading-tight tracking-tight">{creative.headline}</p>
                                </div>
                            )}

                            {creative.text && (
                                <div className="relative">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Activity className="w-3 h-3 text-ch-orange" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Copywriting Principal</span>
                                    </div>
                                    <p className="text-sm font-medium text-foreground/80 leading-relaxed bg-muted/50 p-5 rounded-2xl border border-border">{creative.text}</p>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-6 border-t border-border">
                                <div className="flex items-center gap-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Investimento Total</p>
                                        <h4 className="text-2xl font-bold text-foreground tabular-nums tracking-tighter">
                                            {formatCurrency(spend)}
                                        </h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Intelligence & Audit Side */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            { label: 'Gasto no Ativo', value: formatCurrency(spend), icon: DollarSign, color: 'emerald-500' },
                            { label: 'Alcance Global', value: formatNumber(creative.impressions || 0), icon: Eye, color: 'blue-500' },
                            { label: 'Cliques Únicos', value: formatNumber(creative.clicks || 0), icon: MousePointerClick, color: 'amber-500' },
                            { label: 'CTR do Ativo', value: formatPercent(ctr), icon: TrendingUp, color: 'ch-orange' },
                            { label: 'Custo p/ Clique', value: formatCurrency(cpc), icon: Target, color: 'ch-blue' },
                            { label: 'Resultado', value: formatNumber(creative.conversions || 0), icon: Award, color: 'emerald-600' },
                        ].map((metric) => {
                            const metricKey = metricLabelToKey[metric.label];
                            const isViolated = metricKey ? perfViolations.violatedMetrics.has(metricKey) : false;
                            const violation = isViolated ? perfViolations.violations.find(v => v.metric === metricKey) : null;
                            const displayColor = isViolated ? 'rose-500' : metric.color;

                            return (
                                <motion.div
                                    key={metric.label}
                                    variants={item}
                                    whileHover={{ y: -3 }}
                                    className={`bg-card border rounded-3xl p-6 shadow-sm group ${
                                        isViolated
                                            ? 'border-2 border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/10'
                                            : 'border-border'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`p-2 bg-${displayColor}/10 rounded-xl`}>
                                            <metric.icon className={`w-4 h-4 text-${displayColor}`} />
                                        </div>
                                        <span className={`text-xs font-medium ${isViolated ? 'text-rose-400' : 'text-muted-foreground'}`}>{metric.label}</span>
                                        {isViolated && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 ml-auto" />}
                                    </div>
                                    <p className={`text-2xl font-bold tabular-nums transition-colors ${
                                        isViolated ? 'text-rose-500' : 'text-foreground group-hover:text-ch-orange'
                                    }`}>{metric.value}</p>
                                    {violation && (
                                        <p className="text-[10px] text-rose-400 mt-2 font-medium">
                                            {violation.rule_name}: limite {violation.operator === 'lt' || violation.operator === 'less_than' ? '<' : violation.operator === 'lte' ? '≤' : violation.operator === 'gt' || violation.operator === 'greater_than' ? '>' : violation.operator === 'gte' ? '≥' : '='}{' '}
                                            {violation.metric === 'cpc' || violation.metric === 'spend' ? `R$ ${violation.threshold}` : violation.metric === 'ctr' ? `${violation.threshold}%` : violation.threshold}
                                        </p>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Metadata & Technical Info */}
                    <motion.div variants={item} className="bg-card border border-border rounded-[2rem] p-8 shadow-sm relative overflow-hidden">
                        <div className="absolute bottom-0 right-0 p-12 opacity-[0.05] pointer-events-none">
                            <BarChart3 className="w-48 h-48 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-8 flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-ch-orange rounded-full" /> Parâmetros Técnicos
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                            <div className="space-y-6">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Tipo de Mídia</p>
                                    <p className="text-foreground font-medium capitalize flex items-center gap-2">
                                        {creative.type?.toLowerCase() === 'video' ? '🎬 Vídeo' : creative.type?.toLowerCase() === 'carousel' ? '🎠 Carrossel' : '🖼️ Imagem Estática'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Formato</p>
                                    <p className="text-foreground font-medium capitalize">{creative.creative_format || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Campanha</p>
                                    <p className="text-foreground font-medium truncate">{(creative as any).campaigns?.name || '-'}</p>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Call to Action</p>
                                    <p className="text-foreground font-medium">
                                        {creative.call_to_action?.replace(/_/g, ' ') || 'Nenhum'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                                        {isBranding ? 'Score de Branding' : 'Score de Performance'}
                                    </p>
                                    {(() => {
                                        const score = latestModuleAudit
                                            ? primaryAuditScore(latestModuleAudit, module as AuditFocus)
                                            : null;
                                        if (score == null) {
                                            return <p className="text-sm text-muted-foreground">Não calculado</p>;
                                        }
                                        const cls = score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-red-500';
                                        return <p className={`text-sm font-bold ${cls}`}>{score}/100</p>;
                                    })()}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">ID Externo (Meta)</p>
                                    <p className="text-foreground font-medium text-xs font-mono">{creative.external_id || '-'}</p>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">CPA (Custo por Conversão)</p>
                                    <p className="text-foreground font-medium">
                                        {cpa > 0 ? formatCurrency(cpa) : 'Sem conversões'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Última Atualização</p>
                                    <p className="text-foreground font-medium">
                                        {creative.updated_at ? format(new Date(creative.updated_at), "dd/MM/yyyy 'às' HH:mm") : '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Última Auditoria IA</p>
                                    <div className="flex items-center gap-3">
                                        <p className="text-foreground font-medium">{creative.last_audit_at ? format(new Date(creative.last_audit_at), "dd/MM/yyyy") : 'Pendente'}</p>
                                        {latestModuleAudit && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedAudit(latestModuleAudit);
                                                    setLastPerfResults(
                                                        isBranding
                                                            ? null
                                                            : latestModuleAudit.ai_analysis?.performance_rules_compliance ?? null,
                                                    );
                                                    setIsAuditDetailsOpen(true);
                                                }}
                                                className="h-7 px-2 text-[9px] font-bold uppercase tracking-widest hover:bg-ch-orange/10 hover:text-ch-orange"
                                            >
                                                Ver Detalhes
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* AI Audits History */}
                    {audits && audits.length > 0 && (
                        <motion.div variants={item} className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-sm">
                            <div className="p-8 border-b border-border flex items-center justify-between bg-muted/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-ch-orange/10 rounded-xl">
                                        <ShieldCheck className="w-5 h-5 text-ch-orange" />
                                    </div>
                                    <h2 className="text-lg font-bold text-foreground">Histórico de Auditoria IA</h2>
                                </div>
                            </div>
                            <div className="divide-y divide-border">
                                {audits.map((audit: any) => (
                                    <div
                                        key={audit.id}
                                        onClick={() => {
                                            setSelectedAudit(audit);
                                            setLastPerfResults(
                                                isBranding
                                                    ? null
                                                    : audit.ai_analysis?.performance_rules_compliance ?? null,
                                            );
                                            setIsAuditDetailsOpen(true);
                                        }}
                                        className="p-8 flex flex-col md:flex-row md:items-center justify-between hover:bg-muted/30 transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className={`w-14 h-14 bg-muted border border-border rounded-2xl flex items-center justify-center ${audit.status === 'approved' ? 'group-hover:bg-emerald-500' : 'group-hover:bg-rose-500'} transition-all duration-500 shadow-sm`}>
                                                <Award className="w-6 h-6 text-muted-foreground group-hover:text-black dark:group-hover:text-black" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground group-hover:text-ch-orange transition-colors">
                                                    {auditFocusLabel(resolveAuditFocus(audit))}
                                                </p>
                                                <p className="text-xs text-muted-foreground font-medium mt-1 flex items-center gap-2">
                                                    <Clock className="w-3 h-3" /> {format(new Date(audit.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-10 mt-6 md:mt-0">
                                            {(() => {
                                                const auditScore = primaryAuditScore(audit, module as AuditFocus);
                                                return (
                                                <div className="text-right">
                                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Score IA</p>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div className="h-full bg-ch-orange rounded-full" style={{ width: `${auditScore}%` }} />
                                                        </div>
                                                        <span className="text-sm font-bold text-foreground tabular-nums">{auditScore}%</span>
                                                    </div>
                                                </div>
                                                );
                                            })()}
                                            {getAuditStatusBadge(audit.status)}
                                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-ch-orange group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Audit Details Dialog */}
            <CreativeAuditReportDialog
                open={isAuditDetailsOpen && !!selectedAudit}
                onOpenChange={setIsAuditDetailsOpen}
                audit={selectedAudit}
                creative={creative}
                creativeRules={creativeRules}
                lastRulesCheck={
                    lastRulesCheck ??
                    (ruleCheck
                        ? {
                              overall_score: ruleCheck.overall_score,
                              ai_summary: ruleCheck.ai_summary,
                              results: ruleCheck.results,
                          }
                        : null)
                }
                lastPerfResults={lastPerfResults}
                auditFocus={module}
                isReanalyzing={isAnalyzing}
                onReanalyze={({ forceRefresh }) => {
                    aiAuditAction.mutate({
                        ruleIds: isBranding && selectedRuleIds.size > 0
                            ? Array.from(selectedRuleIds)
                            : undefined,
                        forceRefresh,
                    });
                }}
                footerActions={
                    creative?.campaigns ? (
                        <div className="flex flex-wrap gap-2">
                            {creative.campaigns.status !== 'PAUSED' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (!creative.campaigns?.id) return;
                                        campaignAction.mutate({
                                            campaign_id: creative.campaigns.id,
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
                                    const currentBudget = creative.campaigns?.daily_budget || 0;
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

            {/* Budget Increase Dialog */}
            <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-emerald-500" />
                            Aumentar Verba Diária
                        </DialogTitle>
                        <DialogDescription>
                            Altere o orçamento diário da campanha vinculada a este criativo na Meta.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">
                                Campanha: <span className="font-semibold text-foreground">{creative?.campaigns?.name}</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Verba atual: <span className="font-semibold text-foreground">{formatCurrency(creative?.campaigns?.daily_budget || 0)}</span>
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
                        <div className="flex gap-2 pt-2">
                            {[1.25, 1.5, 2].map((multiplier) => {
                                const currentBudget = creative?.campaigns?.daily_budget || 0;
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
                                    if (!creative?.campaigns?.id || !newBudgetValue) return;
                                    const budgetInCents = Math.round(parseFloat(newBudgetValue) * 100);
                                    campaignAction.mutate(
                                        {
                                            campaign_id: creative.campaigns.id,
                                            action: 'update_budget',
                                            payload: { daily_budget: budgetInCents },
                                        },
                                        { onSuccess: () => {
                                            setBudgetDialogOpen(false);
                                            queryClient.invalidateQueries({ queryKey: ['creative', id] });
                                        }}
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
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            {/* Image Zoom Modal */}
            <Dialog open={imageZoomOpen} onOpenChange={setImageZoomOpen}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none rounded-2xl overflow-hidden flex items-center justify-center">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Preview do Criativo</DialogTitle>
                        <DialogDescription>Imagem do criativo em tela cheia. Clique para fechar.</DialogDescription>
                    </DialogHeader>
                    {creative?.image_url && (
                        <img
                            src={getProxiedImageUrl(creative.image_url, creative.external_id) || creative.image_url}
                            alt={creative.name || 'Creative preview'}
                            className="max-w-full max-h-[90vh] object-contain cursor-zoom-out"
                            onClick={() => setImageZoomOpen(false)}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AnimatePresence>
                {isPreviewOpen && (
                    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                        <DialogContent className="max-w-4xl h-[85vh] flex flex-col bg-background border-border p-0 overflow-hidden rounded-[2.5rem] shadow-sm">
                            <div className="p-6 border-b border-border flex items-center justify-between bg-muted/10">
                                <div className="flex items-center gap-3">
                                    <Eye className="w-5 h-5 text-ch-orange" />
                                    <DialogTitle className="text-lg font-bold text-foreground">
                                        Renderização em Tempo Real
                                    </DialogTitle>
                                    <DialogDescription className="sr-only">
                                        Pré-visualização do anúncio conforme dados da Meta.
                                    </DialogDescription>
                                </div>
                                <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setIsPreviewOpen(false)}>
                                    Fechar
                                </Button>
                            </div>
                            <div className="flex-1 bg-[#f0f2f5] overflow-auto p-8 flex justify-center items-start">
                                {previewContent ? (
                                    <div className="w-full max-w-md shadow-sm rounded-xl overflow-hidden animate-in fade-in zoom-in duration-500">
                                        <div dangerouslySetInnerHTML={{ __html: previewContent }} className="bg-white" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 text-black">
                                        <Loader2 className="w-10 h-10 animate-spin text-ch-orange" />
                                        <span className="text-xs font-medium opacity-60">Consultando Meta API...</span>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>

            {/* AI Analysis Full-Screen Overlay */}
            <AnimatePresence>
                {isAnalyzing && (
                    <motion.div
                        key="ai-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center"
                        style={{ backdropFilter: 'blur(12px)' }}
                    >
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/80" />

                        {/* Content */}
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: -20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
                            className="relative z-10 flex flex-col items-center gap-8 p-10 max-w-lg w-full"
                        >
                            {/* Neural Network Animation */}
                            <div className="relative w-40 h-40">
                                {/* Outer ring - slow rotation */}
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                                    className="absolute inset-0 rounded-full border-2 border-ch-orange/20"
                                >
                                    {[0, 60, 120, 180, 240, 300].map((deg) => (
                                        <motion.div
                                            key={deg}
                                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 2, repeat: Infinity, delay: deg / 360 * 2 }}
                                            className="absolute w-2.5 h-2.5 bg-ch-orange rounded-full"
                                            style={{
                                                top: `${50 - 50 * Math.cos(deg * Math.PI / 180)}%`,
                                                left: `${50 + 50 * Math.sin(deg * Math.PI / 180)}%`,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        />
                                    ))}
                                </motion.div>

                                {/* Middle ring - reverse rotation */}
                                <motion.div
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                                    className="absolute inset-6 rounded-full border border-emerald-500/20"
                                >
                                    {[0, 90, 180, 270].map((deg) => (
                                        <motion.div
                                            key={deg}
                                            animate={{ scale: [1, 1.8, 1], opacity: [0.4, 1, 0.4] }}
                                            transition={{ duration: 1.5, repeat: Infinity, delay: deg / 360 * 1.5 }}
                                            className="absolute w-2 h-2 bg-emerald-400 rounded-full"
                                            style={{
                                                top: `${50 - 50 * Math.cos(deg * Math.PI / 180)}%`,
                                                left: `${50 + 50 * Math.sin(deg * Math.PI / 180)}%`,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        />
                                    ))}
                                </motion.div>

                                {/* Inner ring - fast rotation */}
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                    className="absolute inset-12 rounded-full border border-purple-500/20"
                                >
                                    {[0, 120, 240].map((deg) => (
                                        <motion.div
                                            key={deg}
                                            animate={{ scale: [1, 2, 1], opacity: [0.5, 1, 0.5] }}
                                            transition={{ duration: 1, repeat: Infinity, delay: deg / 360 }}
                                            className="absolute w-1.5 h-1.5 bg-purple-400 rounded-full"
                                            style={{
                                                top: `${50 - 50 * Math.cos(deg * Math.PI / 180)}%`,
                                                left: `${50 + 50 * Math.sin(deg * Math.PI / 180)}%`,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        />
                                    ))}
                                </motion.div>

                                {/* Center icon */}
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    className="absolute inset-0 flex items-center justify-center"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-ch-orange to-amber-600 flex items-center justify-center shadow-sm">
                                        <BrainCircuit className="w-8 h-8 text-white" />
                                    </div>
                                </motion.div>

                                {/* Pulse effect */}
                                <motion.div
                                    animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                                    className="absolute inset-0 rounded-full border-2 border-ch-orange/30"
                                />
                            </div>

                            {/* Title */}
                            <div className="text-center space-y-2">
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-xl font-bold text-white tracking-tight"
                                >
                                    Análise Multi-Agente em Progresso
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="text-sm text-white/50"
                                >
                                    Time de agentes IA está analisando seu criativo
                                </motion.p>
                            </div>

                            {/* Agent Steps */}
                            <div className="w-full space-y-3">
                                {(() => {
                                    const agentIcons = [
                                        { icon: SearchCheck, label: 'Agente de Visão', color: 'text-blue-400', bg: 'bg-blue-500/20' },
                                        { icon: Activity, label: 'Agente de Performance', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
                                        { icon: Dna, label: 'Agente de Marketing', color: 'text-purple-400', bg: 'bg-purple-500/20' },
                                        { icon: ShieldCheck, label: 'Agente de Regras', color: 'text-amber-400', bg: 'bg-amber-500/20' },
                                        { icon: Zap, label: 'Compilação Final', color: 'text-ch-orange', bg: 'bg-ch-orange/20' },
                                    ];

                                    // Map to actual step count
                                    const hasRules = auditTotalSteps > 4;
                                    const visibleAgents = hasRules
                                        ? agentIcons
                                        : agentIcons.filter((_, i) => i !== 3);

                                    return visibleAgents.map((agent, i) => {
                                        const isComplete = i < auditStepIndex;
                                        const isCurrent = i === auditStepIndex;
                                        const isPending = i > auditStepIndex;
                                        const AgentIcon = agent.icon;

                                        return (
                                            <motion.div
                                                key={agent.label}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.4 + i * 0.1 }}
                                                className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-500 ${
                                                    isCurrent
                                                        ? 'bg-white/10 border border-white/20 shadow-sm'
                                                        : isComplete
                                                            ? 'bg-white/5 border border-transparent'
                                                            : 'border border-transparent opacity-40'
                                                }`}
                                            >
                                                <div className={`relative p-2 rounded-lg ${isCurrent ? agent.bg : isComplete ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                                                    {isComplete ? (
                                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                                    ) : (
                                                        <AgentIcon className={`w-4 h-4 ${isCurrent ? agent.color : 'text-white/30'}`} />
                                                    )}
                                                    {isCurrent && (
                                                        <motion.div
                                                            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                                                            transition={{ duration: 1.5, repeat: Infinity }}
                                                            className={`absolute inset-0 rounded-lg ${agent.bg}`}
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <span className={`text-sm font-semibold ${
                                                        isCurrent ? 'text-white' : isComplete ? 'text-white/60' : 'text-white/30'
                                                    }`}>
                                                        {agent.label}
                                                    </span>
                                                    {isCurrent && (
                                                        <motion.p
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            className="text-xs text-white/40 truncate"
                                                        >
                                                            {auditSequence}
                                                        </motion.p>
                                                    )}
                                                </div>

                                                <div className="flex-shrink-0">
                                                    {isComplete && (
                                                        <motion.span
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider"
                                                        >
                                                            Concluído
                                                        </motion.span>
                                                    )}
                                                    {isCurrent && (
                                                        <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    });
                                })()}
                            </div>

                            {/* Progress bar */}
                            <div className="w-full space-y-2">
                                <div className="flex items-center justify-between text-[10px] text-white/40 font-bold uppercase tracking-widest">
                                    <span>Progresso</span>
                                    <span>{auditTotalSteps > 0 ? Math.round(((auditStepIndex + 1) / auditTotalSteps) * 100) : 0}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-ch-orange to-amber-400 rounded-full"
                                        initial={{ width: '0%' }}
                                        animate={{ width: auditTotalSteps > 0 ? `${((auditStepIndex + 1) / auditTotalSteps) * 100}%` : '0%' }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                    />
                                </div>
                            </div>

                            {/* Subtle tip */}
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1.5 }}
                                className="text-[11px] text-white/20 text-center"
                            >
                                A análise é feita por múltiplos agentes especializados para máxima precisão
                            </motion.p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div >
    );
}
