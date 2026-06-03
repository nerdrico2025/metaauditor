import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    BrainCircuit,
    Sparkles,
    Loader2,
    Target,
    TrendingUp,
    ShieldCheck,
    DollarSign,
    Activity,
    Calendar,
    Wand2,
    AlertTriangle,
    Check,
    X,
    ExternalLink,
    ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import { useModule } from '@/contexts/ModuleContext';
import { supabase } from '@/integrations/supabase/client';
import { useAccountRecommendation, RecommendationResponse } from '@/hooks/useAccountRecommendation';
import { useClickHeroRecommendations, useClickHeroRecommendationActions } from '@/hooks/useClickHeroRecommendations';
import { InfoTip } from '@/components/ui/info-tip';
import { formatCurrency, formatNumber } from '@/lib/utils';

const PRIORITY_STYLES: Record<string, { label: string; cls: string }> = {
    high: { label: 'Alta prioridade', cls: 'bg-red-500/10 text-red-500 border-red-500/30' },
    medium: { label: 'Média', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
    low: { label: 'Baixa', cls: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
};

const CATEGORY_ICON: Record<string, typeof Sparkles> = {
    scaling: TrendingUp,
    creative: Sparkles,
    audience: Target,
    budget: DollarSign,
    branding: ShieldCheck,
    tracking: Activity,
    performance: Activity,
};

function scopeButtonClass(isSelected: boolean): string {
    return isSelected
        ? 'flex-1 h-11 ring-2 ring-ch-orange/40 ring-offset-2 ring-offset-background'
        : 'flex-1 h-11';
}

export function RecomendacoesView() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { effectiveIds } = useIntegrationFilter();
    const { module } = useModule();
    const isBranding = module === 'branding';
    const companyId = user?.company?.id;

    const [scope, setScope] = useState<'account' | 'campaign'>('account');
    const [scopeConfirmed, setScopeConfirmed] = useState(false);
    const [campaignId, setCampaignId] = useState<string | undefined>();
    const [result, setResult] = useState<RecommendationResponse | null>(null);

    const scopeReady = scope === 'account' || (scope === 'campaign' && !!campaignId);

    const { data: persistedRecs, isLoading: loadingPersisted } = useClickHeroRecommendations('open', {
        enabled: scopeConfirmed && scopeReady,
    });
    const { updateStatus } = useClickHeroRecommendationActions();

    const creativeRecs = useMemo(() => {
        const source = (persistedRecs ?? []).filter(r => r.source_type === 'creative_audit');
        const byModule = isBranding
            ? source.filter(r => r.category === 'branding')
            : source.filter(r => r.category !== 'branding');
        if (scope === 'campaign' && campaignId) {
            return byModule.filter(r => r.campaign_id === campaignId);
        }
        return byModule;
    }, [persistedRecs, isBranding, scope, campaignId]);

    const { mutate: generate, isPending, isError, error, reset } = useAccountRecommendation();

    useEffect(() => {
        setResult(null);
        setScopeConfirmed(false);
        reset();
    }, [module, reset]);

    const { data: campaigns } = useQuery({
        queryKey: ['recomendacoes-campaign-list', companyId, effectiveIds],
        enabled: !!companyId && scope === 'campaign',
        queryFn: async () => {
            let q = supabase
                .from('campaigns')
                .select('id, name, status')
                .eq('company_id', companyId!)
                .order('name');
            if (effectiveIds.length > 0) q = q.in('integration_id', effectiveIds);
            const { data, error: qErr } = await q;
            if (qErr) throw qErr;
            return data ?? [];
        },
    });

    const selectedCampaignName = useMemo(
        () => (campaigns ?? []).find(c => c.id === campaignId)?.name,
        [campaigns, campaignId],
    );

    const scopeLabel = useMemo(() => {
        if (scope === 'account') return 'Conta completa';
        if (selectedCampaignName) return `Campanha — ${selectedCampaignName}`;
        return 'Campanha (selecione abaixo)';
    }, [scope, selectedCampaignName]);

    const canGenerate = scopeConfirmed && !!companyId && scopeReady;

    const continueLabel =
        scope === 'account'
            ? 'Continuar com conta completa'
            : selectedCampaignName
              ? `Continuar com ${selectedCampaignName}`
              : 'Continuar com campanha';

    const handleScopeChange = (next: 'account' | 'campaign') => {
        setScope(next);
        setScopeConfirmed(false);
        setResult(null);
        reset();
        if (next === 'account') setCampaignId(undefined);
    };

    const handleConfirmScope = () => {
        if (!scopeReady) return;
        setScopeConfirmed(true);
        setResult(null);
        reset();
    };

    const handleGenerate = () => {
        if (!canGenerate) return;
        const payload = scope === 'account'
            ? { scope: 'account' as const, company_id: companyId!, recommendation_focus: module }
            : { scope: 'campaign' as const, campaign_id: campaignId!, recommendation_focus: module };
        generate(payload, {
            onSuccess: (data) => {
                setResult(data);
                if (companyId) {
                    queryClient.invalidateQueries({ queryKey: ['click-hero-recommendations', companyId] });
                }
            },
        });
    };

    const reviewDate = useMemo(() => {
        const d = result?.recommendation.next_review_date_iso;
        if (!d) return null;
        try {
            return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return null;
        }
    }, [result]);

    const displayedRecommendations = useMemo(() => {
        if (!result) return [];
        return result.recommendation.recommendations.filter(rec =>
            isBranding ? rec.category === 'branding' : rec.category !== 'branding',
        );
    }, [result, isBranding]);

    const helpText = isBranding
        ? 'Confirme o escopo da análise e clique em Continuar para ver recomendações dos criativos. Depois use Gerar recomendações para a análise estratégica da IA (compliance, regras e contexto da conta).'
        : 'Confirme o escopo da análise e clique em Continuar para ver recomendações dos criativos. Depois use Gerar recomendações para a análise estratégica da IA (métricas, campanhas e regras de performance).';

    const creativeEmptyHint = isBranding
        ? 'Rode uma Análise Profissional IA (módulo Branding) em um criativo para ver recomendações aqui.'
        : 'Rode uma Análise Profissional IA (módulo Performance) em um criativo para ver recomendações aqui.';

    const isQuotaError = error instanceof Error && /cota|crédito|429|quota/i.test(error.message);

    const creativeRecsTitle = isBranding
        ? 'Recomendações de branding dos criativos'
        : 'Recomendações de performance dos criativos';

    return (
        <div className="space-y-6">
            {/* Scope selector — always first */}
            <Card>
                <CardContent className="pt-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-end gap-4">
                        <div className="flex-1 grid gap-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                Selecionar escopo da análise
                            </label>
                            <div className="flex gap-2">
                                <InfoTip title="Conta completa" hint="Analisa todas as campanhas dos últimos 30 dias. Confirme o escopo antes de carregar as recomendações.">
                                    <Button
                                        variant={scope === 'account' ? 'default' : 'outline'}
                                        onClick={() => handleScopeChange('account')}
                                        className={scopeButtonClass(scope === 'account')}
                                    >
                                        <BrainCircuit className="w-4 h-4 mr-2" />
                                        Conta completa
                                    </Button>
                                </InfoTip>
                                <InfoTip title="Campanha específica" hint="Foca em uma campanha que você escolhe. Confirme o escopo antes de carregar as recomendações.">
                                    <Button
                                        variant={scope === 'campaign' ? 'default' : 'outline'}
                                        onClick={() => handleScopeChange('campaign')}
                                        className={scopeButtonClass(scope === 'campaign')}
                                    >
                                        <Target className="w-4 h-4 mr-2" />
                                        Campanha
                                    </Button>
                                </InfoTip>
                            </div>
                        </div>
                        {scope === 'campaign' && (
                            <div className="flex-1 grid gap-2 md:max-w-xs">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Campanha
                                </label>
                                <Select
                                    value={campaignId}
                                    onValueChange={(id) => {
                                        setCampaignId(id);
                                        setScopeConfirmed(false);
                                        setResult(null);
                                        reset();
                                    }}
                                >
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(campaigns ?? []).map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {!scopeConfirmed && (
                            <Button
                                onClick={handleConfirmScope}
                                disabled={!scopeReady}
                                className="h-11 font-semibold px-6"
                            >
                                <ArrowRight className="w-4 h-4 mr-2" />
                                {continueLabel}
                            </Button>
                        )}
                        {scopeConfirmed && (
                            <InfoTip
                                title="Gerar recomendações"
                                hint={isBranding
                                    ? 'Envia compliance, regras violadas e contexto da conta para a IA montar recomendações de branding.'
                                    : 'Envia métricas, campanhas e regras de performance para a IA montar recomendações estratégicas.'}
                            >
                                <Button
                                    onClick={handleGenerate}
                                    disabled={!canGenerate || isPending}
                                    className="h-11 bg-ch-orange text-primary-foreground font-semibold px-6"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                                    {isPending ? 'Analisando...' : 'Gerar recomendações'}
                                </Button>
                            </InfoTip>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-semibold">
                            Escopo: {scopeLabel}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            Foco: {isBranding ? 'Branding' : 'Performance'}
                        </Badge>
                        {scopeConfirmed && (
                            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30">
                                Escopo confirmado
                            </Badge>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground">{helpText}</p>
                </CardContent>
            </Card>

            {/* Placeholder before scope confirmation */}
            {!scopeConfirmed && (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3 border border-dashed border-border rounded-2xl bg-muted/20">
                    <Target className="w-10 h-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground max-w-md">
                        Confirme o escopo acima para carregar as recomendações dos criativos e iniciar a análise estratégica.
                    </p>
                </div>
            )}

            {/* Persisted creative audit recommendations — after scope confirmed */}
            {scopeConfirmed && (
                <Card>
                    <CardContent className="pt-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-ch-orange" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">
                                {creativeRecsTitle}
                            </h3>
                        </div>
                        {loadingPersisted ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Carregando...
                            </div>
                        ) : creativeRecs.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">{creativeEmptyHint}</p>
                        ) : (
                            <div className="space-y-3">
                                {creativeRecs.map(rec => {
                                    const Icon = CATEGORY_ICON[rec.category] || Sparkles;
                                    const pri = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.medium;
                                    return (
                                        <Card key={rec.id} className="border-border/80">
                                            <CardContent className="pt-4 space-y-2">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 rounded-lg bg-ch-orange/10 text-ch-orange flex-shrink-0">
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                                            <h4 className="text-sm font-bold">{rec.title}</h4>
                                                            <Badge variant="outline" className={`text-[10px] font-bold border ${pri.cls}`}>
                                                                {pri.label}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground leading-relaxed">{rec.rationale}</p>
                                                        <p className="text-xs font-medium mt-2">{rec.next_step}</p>
                                                        {rec.creative_id && (
                                                            <Link
                                                                to={`/criativos/${rec.creative_id}`}
                                                                className="inline-flex items-center gap-1 text-xs text-ch-orange font-semibold mt-2 hover:underline"
                                                            >
                                                                {rec.creatives?.name ? `Ver: ${rec.creatives.name}` : 'Ver criativo'}
                                                                <ExternalLink className="w-3 h-3" />
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2 pt-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-xs"
                                                        disabled={updateStatus.isPending}
                                                        onClick={() => updateStatus.mutate({ id: rec.id, status: 'done' })}
                                                    >
                                                        <Check className="w-3.5 h-3.5 mr-1" />
                                                        Feita
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 text-xs text-muted-foreground"
                                                        disabled={updateStatus.isPending}
                                                        onClick={() => updateStatus.mutate({ id: rec.id, status: 'dismissed' })}
                                                    >
                                                        <X className="w-3.5 h-3.5 mr-1" />
                                                        Dispensar
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Strategic analysis result */}
            {result && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                >
                    <Card>
                        <CardContent className="pt-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-ch-orange" />
                                <span className="text-xs font-bold uppercase tracking-widest text-ch-orange">
                                    Click Auditor — {isBranding ? 'Branding' : 'Performance'}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">{result.recommendation.headline}</h2>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {result.recommendation.summary}
                            </p>
                            {reviewDate && (
                                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-md px-2 py-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Próxima revisão sugerida: <strong className="text-foreground">{reviewDate}</strong>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {!isBranding ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Investido (30d)', value: formatCurrency(result.snapshot.metrics.spend) },
                                { label: 'Conversões', value: formatNumber(result.snapshot.metrics.conversions) },
                                { label: 'CTR médio', value: `${result.snapshot.metrics.avg_ctr.toFixed(2)}%` },
                                { label: 'CPA médio', value: result.snapshot.metrics.avg_cpa > 0 ? formatCurrency(result.snapshot.metrics.avg_cpa) : '—' },
                            ].map(kpi => (
                                <Card key={kpi.label}>
                                    <CardContent className="pt-4">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{kpi.label}</p>
                                        <p className="text-lg font-bold mt-1">{kpi.value}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Aprovados', value: formatNumber(result.snapshot.branding_compliance.approved) },
                                { label: 'Reprovados', value: formatNumber(result.snapshot.branding_compliance.rejected) },
                                { label: 'Pendentes', value: formatNumber(result.snapshot.branding_compliance.pending) },
                                { label: 'Criativos', value: formatNumber(result.snapshot.creative_count) },
                            ].map(kpi => (
                                <Card key={kpi.label}>
                                    <CardContent className="pt-4">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{kpi.label}</p>
                                        <p className="text-lg font-bold mt-1">{kpi.value}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    <div className="space-y-3">
                        <h3 className="text-base font-bold uppercase tracking-widest text-muted-foreground">
                            Recomendações ({displayedRecommendations.length})
                        </h3>
                        {displayedRecommendations.map((rec, idx) => {
                            const Icon = CATEGORY_ICON[rec.category] || Sparkles;
                            const pri = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.medium;
                            return (
                                <Card key={idx}>
                                    <CardContent className="pt-4 space-y-2">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-ch-orange/10 text-ch-orange flex-shrink-0">
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <h4 className="text-sm font-bold text-foreground">{rec.title}</h4>
                                                    <Badge variant="outline" className={`text-[10px] font-bold border ${pri.cls}`}>
                                                        {pri.label}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground leading-relaxed">{rec.rationale}</p>
                                                <div className="mt-2 flex items-start gap-2 p-2 rounded-md bg-muted/40 border border-border">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 flex-shrink-0">
                                                        Próximo passo
                                                    </span>
                                                    <span className="text-xs font-medium text-foreground">{rec.next_step}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {isBranding && (result.snapshot.branding_compliance.rejected > 0 || result.snapshot.top_violated_rules.length > 0) && (
                        <Card>
                            <CardContent className="pt-4">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                    Compliance de Branding observada
                                </p>
                                <div className="flex items-center gap-3 mb-3 text-sm">
                                    <span className="text-emerald-500">{result.snapshot.branding_compliance.approved} aprovados</span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-red-500">{result.snapshot.branding_compliance.rejected} reprovados</span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-muted-foreground">{result.snapshot.branding_compliance.pending} pendentes</span>
                                </div>
                                {result.snapshot.top_violated_rules.length > 0 && (
                                    <ul className="space-y-1 text-xs">
                                        {result.snapshot.top_violated_rules.map(r => (
                                            <li key={r.rule_name} className="flex justify-between border-b border-border py-1.5">
                                                <span className="text-foreground">{r.rule_name}</span>
                                                <span className="text-red-500 font-bold">{r.count}x</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </motion.div>
            )}

            {isError && !isPending && (
                <Card className="border-red-500/30 bg-red-500/5">
                    <CardContent className="pt-5 flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10 text-red-500 flex-shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-red-500">Não foi possível gerar as recomendações</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {error instanceof Error ? error.message : 'Erro inesperado. Tente novamente.'}
                            </p>
                            {isQuotaError && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Verifique o billing/créditos na conta OpenAI e confirme que a secret{' '}
                                    <code className="text-[11px] bg-muted px-1 rounded">OPENAI_API_KEY</code>{' '}
                                    está configurada no Supabase (Project Settings → Edge Functions → Secrets).
                                </p>
                            )}
                            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={!canGenerate} className="mt-2">
                                Tentar novamente
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {scopeConfirmed && !result && !isPending && !isError && (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3 border border-dashed border-border rounded-2xl bg-muted/20">
                    <BrainCircuit className="w-12 h-12 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground max-w-md">
                        <strong className="text-foreground">{scopeLabel}</strong> confirmado
                        {' · '}
                        foco <strong className="text-foreground">{isBranding ? 'Branding' : 'Performance'}</strong>.
                        {' '}Clique em <strong className="text-foreground">Gerar recomendações</strong> para iniciar a análise estratégica.
                    </p>
                </div>
            )}
        </div>
    );
}
