import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    BrainCircuit,
    CheckCircle,
    ChevronDown,
    Database,
    Dna,
    FileImage,
    Film,
    Loader2,
    MousePointerClick,
    RefreshCw,
    SearchCheck,
    ShieldCheck,
    Sparkles,
    Type,
    Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AuditCopyDiagnosis } from '@/components/audits/AuditCopyDiagnosis';
import { AuditCreativeProfile } from '@/components/audits/AuditCreativeProfile';
import { AuditImprovementPlan } from '@/components/audits/AuditImprovementPlan';
import { AuditMarketingSummary } from '@/components/audits/AuditMarketingSummary';
import { AuditPersuasionSection } from '@/components/audits/AuditPersuasionSection';
import { AuditVisualSection } from '@/components/audits/AuditVisualSection';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatCurrency } from '@/lib/utils';
import type { AiAnalysis } from '@/hooks/useAudits';
import { useAuditDetail } from '@/hooks/useAudits';
import { useAuth } from '@/contexts/AuthContext';
import type { AuditFocus } from '@/lib/audit-focus';
import { auditFocusLabel, resolveAuditFocus } from '@/lib/audit-focus';
import {
    buildImprovementActions,
    hasFrameworkScores,
    hasNarrativeData,
} from '@/lib/audit-improvements';
import { getScalingBadge } from '@/lib/audit-scores';
import {
    classifyLogoVerdict,
    dedupeRuleProblems,
    excludeLogoRulesFromSummary,
    filterContradictoryStrengths,
    type LogoVerdict,
} from '@/lib/auditCoherence';
import { filterNarrativeAgainstRules } from '@/lib/auditReportDedup';

interface PerfRow {
    rule_name: string;
    passed: boolean;
    reason: string;
}

interface BrandingRuleRow {
    rule_id: string;
    rule_name: string;
    passed: boolean;
    reason: string;
    severity: string;
}

interface RulesCheckResult {
    overall_score?: number;
    ai_summary?: string;
    results?: BrandingRuleRow[];
}

export interface AuditProblem {
    id: string;
    title: string;
    detail?: string;
    severity: 'error' | 'warning' | 'info';
}

interface CreativeAuditReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    audit: {
        id?: string;
        status?: string | null;
        compliance_score?: number | null;
        score?: number | null;
        performance_score?: number | null;
        issues?: Array<{ severity: string; message: string }> | null;
        recommendations?: string[] | null;
        ai_analysis?: AiAnalysis | null;
        policy_id?: string | null;
        audit_focus?: string | null;
        audit_type?: string;
    } | null;
    creative?: {
        text?: string | null;
        headline?: string | null;
        description?: string | null;
        call_to_action?: string | null;
        image_url?: string | null;
        video_url?: string | null;
        spend?: number | null;
        impressions?: number | null;
        clicks?: number | null;
        ctr?: number | null;
        cpc?: number | null;
        campaigns?: { id: string; status?: string; daily_budget?: number | null } | null;
    } | null;
    creativeRules?: Array<{ id: string; name: string }> | null;
    lastRulesCheck?: RulesCheckResult | null;
    lastPerfResults?: PerfRow[] | null;
    auditFocus?: AuditFocus;
    onReanalyze?: (opts: { forceRefresh: boolean; ruleIds?: string[] }) => void;
    isReanalyzing?: boolean;
    footerActions?: React.ReactNode;
}

function normalizeSeverity(severity: string): AuditProblem['severity'] {
    if (severity === 'error') return 'error';
    if (severity === 'info') return 'info';
    return 'warning';
}

function buildProblemsList(
    issues: NonNullable<CreativeAuditReportDialogProps['audit']>['issues'],
    perfResults: PerfRow[],
    brandingResults: BrandingRuleRow[],
    isBranding: boolean,
): AuditProblem[] {
    const problems: AuditProblem[] = [];

    (issues ?? []).forEach((issue, i) => {
        problems.push({
            id: `issue-${i}`,
            title: issue.message,
            severity: normalizeSeverity(issue.severity),
        });
    });

    perfResults.filter(r => !r.passed).forEach((r, i) => {
        problems.push({
            id: `perf-${i}`,
            title: r.rule_name,
            detail: r.reason,
            severity: 'error',
        });
    });

    if (!isBranding) {
        brandingResults.filter(r => !r.passed).forEach((r, i) => {
            problems.push({
                id: `brand-${i}`,
                title: r.rule_name,
                detail: r.reason,
                severity: normalizeSeverity(r.severity),
            });
        });
    }

    return problems;
}

function buildStrengthsList(
    rawAnalysis: AiAnalysis,
    perfResults: PerfRow[],
    brandingResults: BrandingRuleRow[],
    isBranding: boolean,
): string[] {
    const fromAi = [...(rawAnalysis.strengths ?? [])];
    if (fromAi.length > 0) {
        if (isBranding) {
            return filterContradictoryStrengths(fromAi, brandingResults);
        }
        return fromAi;
    }

    const passedRules = isBranding
        ? brandingResults.filter(r => r.passed)
        : perfResults.filter(r => r.passed);

    return passedRules.map(r => `${r.rule_name}: ${r.reason}`);
}

function buildOpportunitiesList(
    weaknesses: string[],
    problems: AuditProblem[],
): string[] {
    const problemTexts = new Set(
        problems.flatMap(p => [p.title.toLowerCase(), p.detail?.toLowerCase()].filter(Boolean) as string[]),
    );

    return weaknesses.filter(w => {
        const lower = w.toLowerCase();
        return ![...problemTexts].some(p => lower.includes(p) || p.includes(lower.slice(0, 20)));
    });
}

function isSuggestionCovered(actions: { description: string }[], suggestion: string): boolean {
    const normalized = suggestion.toLowerCase().trim();
    return actions.some(a => {
        const desc = a.description.toLowerCase().trim();
        return desc.includes(normalized) || normalized.includes(desc);
    });
}

function buildNeutralVerdict(
    focus: AuditFocus,
    problemsCount: number,
): string {
    const focusLabel = focus === 'branding' ? 'branding' : 'performance';
    if (problemsCount === 0) {
        return `Análise concluída com base nas regras e políticas configuradas. Nenhum problema detectado em ${focusLabel}.`;
    }
    return `Análise concluída com base nas regras e políticas configuradas. ${problemsCount} problema(s) encontrado(s) em ${focusLabel}.`;
}

function resolveAuditDisplayData(
    rawAnalysis: AiAnalysis,
    audit: NonNullable<CreativeAuditReportDialogProps['audit']>,
    lastRulesCheck: RulesCheckResult | null | undefined,
    lastPerfResults: PerfRow[] | null | undefined,
    focus: AuditFocus,
) {
    const isBranding = focus === 'branding';
    const hasFrameworkScoresFlag = hasFrameworkScores(rawAnalysis);

    const perfResults: PerfRow[] = isBranding
        ? []
        : lastPerfResults?.length
            ? lastPerfResults
            : rawAnalysis.performance_rules_compliance ?? [];

    const brandingResults: BrandingRuleRow[] = isBranding
        ? lastRulesCheck?.results?.length
            ? lastRulesCheck.results
            : (rawAnalysis.rules_compliance ?? []).map(r => ({
                rule_id: '',
                rule_name: r.rule_name,
                passed: r.passed,
                reason: r.reason,
                severity: 'warning',
            }))
        : [];

    let problems = buildProblemsList(audit.issues, perfResults, brandingResults, isBranding);
    if (isBranding) {
        problems = dedupeRuleProblems(problems, brandingResults);
    }

    const rawStrengths = buildStrengthsList(rawAnalysis, perfResults, brandingResults, isBranding);
    const rawSuggestions = rawAnalysis.suggestions ?? rawAnalysis.action_plan ?? audit.recommendations ?? [];
    const rawTone =
        rawAnalysis.executive_summary ??
        rawAnalysis.tone_analysis ??
        buildNeutralVerdict(focus, problems.length);

    const dedupedNarrative = filterNarrativeAgainstRules({
        strengths: rawStrengths,
        weaknesses: rawAnalysis.weaknesses ?? [],
        suggestions: rawSuggestions,
        toneAnalysis: rawTone,
        brandingResults,
        perfResults,
    });

    const strengths = dedupedNarrative.strengths;
    const logoVerdict = isBranding ? classifyLogoVerdict(brandingResults) : null;
    const opportunities = buildOpportunitiesList(dedupedNarrative.weaknesses, problems);
    const suggestions = dedupedNarrative.suggestions;
    const tone_analysis = dedupedNarrative.toneAnalysis ?? buildNeutralVerdict(focus, problems.length);
    const brandingResultsForSummary = isBranding
        ? excludeLogoRulesFromSummary(brandingResults)
        : brandingResults;

    const rulesPassed = isBranding
        ? brandingResults.filter(r => r.passed).length
        : perfResults.filter(r => r.passed).length;
    const rulesFailed = isBranding
        ? brandingResults.filter(r => !r.passed).length
        : perfResults.filter(r => !r.passed).length;

    const analysisPayload = {
        strengths,
        opportunities,
        suggestions,
        tone_analysis,
        performance_diagnosis: rawAnalysis.performance_diagnosis,
        scaling_recommendation: rawAnalysis.scaling_recommendation,
        score_breakdown: rawAnalysis.score_breakdown,
    };

    const hasNarrativeDataFlag = hasNarrativeData(rawAnalysis, analysisPayload);

    const hasQualitativeSections =
        !!rawAnalysis.visual_analysis ||
        (rawAnalysis.persuasion_triggers_found?.length ?? 0) > 0 ||
        (rawAnalysis.persuasion_triggers_missing?.length ?? 0) > 0;

    const hasContent =
        problems.length > 0 ||
        strengths.length > 0 ||
        opportunities.length > 0 ||
        suggestions.length > 0 ||
        !!tone_analysis ||
        hasNarrativeDataFlag ||
        hasQualitativeSections;

    return {
        analysis: analysisPayload,
        problems,
        perfResults,
        brandingResults,
        brandingResultsForSummary,
        logoVerdict,
        rulesPassed,
        rulesFailed,
        issuesCount: problems.length,
        hasContent,
        hasFrameworkScores: hasFrameworkScoresFlag,
        hasNarrativeData: hasNarrativeDataFlag,
        hasQualitativeSections,
    };
}

export function CreativeAuditReportDialog({
    open,
    onOpenChange,
    audit,
    creative,
    creativeRules,
    lastRulesCheck,
    lastPerfResults,
    auditFocus: auditFocusProp,
    onReanalyze,
    isReanalyzing,
    footerActions,
}: CreativeAuditReportDialogProps) {
    const [layer, setLayer] = useState<'summary' | 'detail'>('summary');
    const { user } = useAuth();
    const companyId = user?.company?.id ?? user?.company_id ?? null;
    const { data: detailAudit, isLoading: detailLoading } = useAuditDetail(
        open && audit?.id ? audit.id : undefined,
        companyId,
    );
    const resolvedAudit = detailAudit ?? audit;

    useEffect(() => {
        if (open) setLayer('summary');
    }, [open, audit?.id]);

    const rawAnalysis = resolvedAudit?.ai_analysis ?? {};
    const focus: AuditFocus = auditFocusProp ?? resolveAuditFocus(resolvedAudit);
    const isBranding = focus === 'branding';
    const isApproved = resolvedAudit?.status === 'approved';
    const isRejected = resolvedAudit?.status === 'rejected';

    const textAccentClass = isRejected ? 'text-rose-500' : isApproved ? 'text-emerald-500' : 'text-ch-orange';
    const bgAccentClass = isRejected ? 'bg-rose-500/10' : isApproved ? 'bg-emerald-500/10' : 'bg-ch-orange/10';
    const borderAccentClass = isRejected ? 'border-rose-500/20' : isApproved ? 'border-emerald-500/20' : 'border-ch-orange/20';
    const gradientHeader = isRejected
        ? 'from-rose-950 to-ch-black'
        : isApproved
            ? 'from-emerald-950 to-ch-black'
            : 'from-ch-orange/20 to-ch-black';
    const statusLabel = isApproved ? 'Aprovado' : isRejected ? 'Reprovado' : 'Revisão pendente';

    const resolved = useMemo(
        () =>
            resolvedAudit
                ? resolveAuditDisplayData(rawAnalysis, resolvedAudit, lastRulesCheck, lastPerfResults, focus)
                : null,
        [rawAnalysis, resolvedAudit, lastRulesCheck, lastPerfResults, focus],
    );

    const improvementActions = useMemo(
        () => {
            if (!resolvedAudit || !resolved) return [];
            return buildImprovementActions({
                creative,
                problems: resolved.problems,
                perfResults: resolved.perfResults,
                brandingResults: resolved.brandingResults,
                suggestions: resolved.analysis.suggestions,
                recommendations: resolvedAudit.recommendations,
                auditFocus: focus,
            });
        },
        [creative, resolvedAudit, resolved, focus],
    );

    if (!resolvedAudit || !resolved) return null;

    const showDetailLoader = detailLoading && open && !!audit?.id && !detailAudit;

    const {
        analysis,
        problems,
        perfResults,
        brandingResults,
        brandingResultsForSummary,
        logoVerdict,
        rulesPassed,
        rulesFailed,
        issuesCount,
        hasContent,
        hasFrameworkScores: hasFrameworkScoresFlag,
        hasNarrativeData: hasNarrativeDataFlag,
        hasQualitativeSections,
    } = resolved;

    const summarySuggestions = analysis.suggestions.slice(0, 3);
    const extraSuggestions = analysis.suggestions.filter(
        s => !isSuggestionCovered(improvementActions, s),
    );
    const scalingBadge = !isBranding ? getScalingBadge(analysis.scaling_recommendation) : null;

    const kpiItems = isBranding
        ? [
            { label: 'Erros encontrados', value: issuesCount },
            { label: 'Regras de branding aprovadas', value: rulesPassed },
            { label: 'Regras de branding reprovadas', value: rulesFailed },
        ]
        : [
            { label: 'Erros encontrados', value: issuesCount },
            { label: 'Regras de performance aprovadas', value: rulesPassed },
            { label: 'Regras de performance reprovadas', value: rulesFailed },
        ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[min(90vh,800px)] flex flex-col bg-background border-border p-0 overflow-hidden rounded-2xl shadow-sm gap-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Relatório de auditoria IA</DialogTitle>
                    <DialogDescription>Resultado da auditoria para este criativo.</DialogDescription>
                </DialogHeader>

                <div className={`relative shrink-0 h-28 sm:h-32 bg-gradient-to-br ${gradientHeader} px-6 py-4 flex flex-col justify-end border-b border-border`}>
                    <div className="flex items-center gap-2 mb-1">
                        <BrainCircuit className={`w-5 h-5 ${textAccentClass}`} />
                        <span className={`text-[10px] font-bold ${textAccentClass} uppercase tracking-widest`}>
                            {layer === 'summary' ? 'Resumo da Auditoria' : 'Relatório Detalhado'}
                        </span>
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-tight truncate">
                        {auditFocusLabel(focus)}
                    </h2>
                    <span className={`inline-flex w-fit mt-1 items-center border font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        isApproved
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : isRejected
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}>
                        {statusLabel}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/20 custom-scrollbar min-h-0">
                    {showDetailLoader ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Carregando relatório completo…</p>
                        </div>
                    ) : layer === 'summary' ? (
                        hasContent ? (
                            <>
                                {isBranding && logoVerdict && (
                                    <LogoStatusBanner verdict={logoVerdict} />
                                )}

                                <ViolatedRulesSummary
                                    isBranding={isBranding}
                                    perfResults={perfResults}
                                    brandingResults={brandingResultsForSummary}
                                />

                                {problems.length > 0 && <ProblemsSection problems={problems} />}

                                {analysis.strengths.length > 0 && (
                                    <ListSection
                                        title="Pontos fortes"
                                        icon={<Sparkles className="w-3 h-3 text-emerald-500" />}
                                        items={analysis.strengths}
                                        variant="success"
                                    />
                                )}

                                {analysis.tone_analysis && (
                                    <div>
                                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <Dna className="w-3 h-3 text-ch-orange" /> Veredito
                                        </h4>
                                        <p className="text-sm text-foreground/80 leading-relaxed border-l-4 border-ch-orange pl-4">
                                            {analysis.tone_analysis}
                                        </p>
                                    </div>
                                )}

                                {summarySuggestions.length > 0 && (
                                    <ActionPlanSection items={summarySuggestions} title="Plano de ação" />
                                )}
                            </>
                        ) : (
                            <div className="rounded-xl border border-dashed border-border bg-card/30 p-6 text-center">
                                <p className="text-sm text-muted-foreground">
                                    Execute a análise com regras selecionadas para gerar o relatório.
                                </p>
                            </div>
                        )
                    ) : hasContent ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {kpiItems.map(item => (
                                    <div key={item.label} className="rounded-xl border border-border bg-card p-3 text-center">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-tight">{item.label}</p>
                                        <p className="text-xl font-bold tabular-nums mt-1">{item.value}</p>
                                    </div>
                                ))}
                            </div>

                            {(hasNarrativeDataFlag || !!analysis.performance_diagnosis || !!analysis.scaling_recommendation) && (
                                <AuditMarketingSummary ai={rawAnalysis} auditFocus={focus} />
                            )}

                            <AuditCreativeProfile creative={creative} auditFocus={focus} />

                            <ProblemsSection problems={problems} />

                            {analysis.strengths.length > 0 && (
                                <ListSection
                                    title="Pontos fortes"
                                    icon={<Sparkles className="w-3 h-3 text-emerald-500" />}
                                    items={analysis.strengths}
                                    variant="success"
                                />
                            )}

                            {analysis.opportunities.length > 0 && (
                                <ListSection
                                    title="Oportunidades"
                                    icon={<AlertTriangle className={`w-3 h-3 ${textAccentClass}`} />}
                                    items={analysis.opportunities}
                                    variant="warning"
                                    accentClass={bgAccentClass}
                                    borderClass={borderAccentClass}
                                />
                            )}

                            {analysis.tone_analysis && (
                                <div>
                                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Dna className="w-3 h-3 text-ch-orange" /> Veredito
                                    </h4>
                                    <p className="text-sm text-foreground/80 leading-relaxed border-l-4 border-ch-orange pl-4">
                                        {analysis.tone_analysis}
                                    </p>
                                </div>
                            )}

                            {summarySuggestions.length > 0 && (
                                <ActionPlanSection items={summarySuggestions} title="Plano de ação" />
                            )}

                            <AuditCopyDiagnosis creative={creative} focus={focus} />
                            <AuditImprovementPlan actions={improvementActions} />

                            {hasQualitativeSections && (
                                <>
                                    <AuditPersuasionSection ai={rawAnalysis} compact />
                                    <AuditVisualSection ai={rawAnalysis} compact />
                                </>
                            )}

                            {!isBranding && (analysis.performance_diagnosis || analysis.scaling_recommendation) && (
                                <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
                                    {analysis.performance_diagnosis && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
                                                <BarChart3 className="w-3 h-3" /> Diagnóstico de performance
                                            </h4>
                                            <p className="text-sm text-muted-foreground">{analysis.performance_diagnosis}</p>
                                        </div>
                                    )}
                                    {scalingBadge && (
                                        <Badge variant="outline" className={`${scalingBadge.color} border-0`}>
                                            {scalingBadge.label}
                                        </Badge>
                                    )}
                                </div>
                            )}

                            <RulesSection
                                isBranding={isBranding}
                                brandingResults={brandingResults}
                                perfResults={perfResults}
                                lastRulesCheck={lastRulesCheck}
                                expanded
                            />

                            {extraSuggestions.length > 0 && (
                                <ActionPlanSection items={extraSuggestions} title="Plano de ação completo" />
                            )}

                            <SourcesCollapsible
                                creative={creative}
                                audit={resolvedAudit}
                                creativeRules={creativeRules}
                                auditFocus={focus}
                            />
                        </>
                    ) : (
                        <div className="rounded-xl border border-dashed border-border bg-card/30 p-6 text-center">
                            <p className="text-sm text-muted-foreground">
                                Execute a análise com regras selecionadas para gerar o relatório.
                            </p>
                        </div>
                    )}
                </div>

                <div className="shrink-0 p-4 border-t border-border bg-muted/30 space-y-3">
                    {layer === 'detail' && footerActions}
                    <div className="flex flex-wrap justify-between gap-2">
                        {onReanalyze && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground"
                                disabled={isReanalyzing}
                                onClick={() => onReanalyze({ forceRefresh: true })}
                            >
                                {isReanalyzing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                ) : (
                                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                Reanalise
                            </Button>
                        )}
                        <div className="flex flex-wrap justify-end gap-2 ml-auto">
                            {layer === 'summary' ? (
                                <Button
                                    variant="default"
                                    className="bg-ch-orange hover:bg-ch-orange-hover text-white font-semibold"
                                    onClick={() => setLayer('detail')}
                                >
                                    Relatório Detalhado
                                </Button>
                            ) : (
                                <Button variant="outline" onClick={() => setLayer('summary')}>
                                    Voltar ao resumo
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Fechar
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function LogoStatusBanner({ verdict }: { verdict: LogoVerdict }) {
    const styleMap = {
        ok: {
            container: 'bg-emerald-500/10 border-emerald-500/20',
            icon: 'text-emerald-500',
            title: 'text-emerald-600 dark:text-emerald-400',
        },
        absent: {
            container: 'bg-rose-500/10 border-rose-500/20',
            icon: 'text-rose-500',
            title: 'text-rose-600 dark:text-rose-400',
        },
        unknown: {
            container: 'bg-amber-500/10 border-amber-500/20',
            icon: 'text-amber-500',
            title: 'text-amber-600 dark:text-amber-400',
        },
    };
    const styles = styleMap[verdict.status] ?? styleMap.unknown;

    const Icon = verdict.status === 'ok' ? CheckCircle : AlertTriangle;

    return (
        <div className={`rounded-xl border p-4 ${styles.container}`}>
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-muted-foreground" /> Status do logo
            </h4>
            <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${styles.icon}`} />
                <div>
                    <p className={`text-sm font-semibold ${styles.title}`}>{verdict.label}</p>
                    {verdict.detail && (
                        <p className="text-xs text-muted-foreground mt-1">{verdict.detail}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function ViolatedRulesSummary({
    isBranding,
    perfResults,
    brandingResults,
}: {
    isBranding: boolean;
    perfResults: PerfRow[];
    brandingResults: BrandingRuleRow[];
}) {
    const violated = isBranding
        ? brandingResults.filter(r => !r.passed)
        : perfResults.filter(r => !r.passed);

    const sectionTitle = isBranding ? 'Regras de branding violadas' : 'Regras de performance violadas';
    const SectionIcon = isBranding ? ShieldCheck : Activity;

    return (
        <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <SectionIcon className="w-3 h-3 text-rose-500" /> {sectionTitle}
            </h4>
            {violated.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    Nenhuma regra violada.
                </p>
            ) : (
                <div className="space-y-2">
                    {violated.map((rule, i) => (
                        <div
                            key={`violated-${i}`}
                            className="p-3 rounded-xl text-sm border bg-rose-500/5 border-rose-500/10"
                        >
                            <p className="font-semibold text-foreground">{rule.rule_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{rule.reason}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ProblemsSection({ problems }: { problems: AuditProblem[] }) {
    return (
        <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-rose-500" /> Problemas encontrados
            </h4>
            {problems.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    Nenhum problema detectado.
                </p>
            ) : (
                <div className="space-y-2">
                    {problems.map(problem => (
                        <div
                            key={problem.id}
                            className={`p-3 rounded-xl text-sm border ${
                                problem.severity === 'error'
                                    ? 'bg-rose-500/5 border-rose-500/10'
                                    : problem.severity === 'warning'
                                        ? 'bg-amber-500/5 border-amber-500/10'
                                        : 'bg-blue-500/5 border-blue-500/10'
                            }`}
                        >
                            <p className="font-semibold text-foreground">{problem.title}</p>
                            {problem.detail && (
                                <p className="text-xs text-muted-foreground mt-0.5">{problem.detail}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ListSection({
    title,
    icon,
    items,
    variant,
    accentClass,
    borderClass,
}: {
    title: string;
    icon: React.ReactNode;
    items: string[];
    variant: 'success' | 'warning';
    accentClass?: string;
    borderClass?: string;
}) {
    return (
        <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                {icon} {title}
            </h4>
            {items.map((item, i) => (
                <div
                    key={i}
                    className={`flex gap-2 p-3 rounded-xl text-sm border ${
                        variant === 'success'
                            ? 'bg-emerald-500/5 border-emerald-500/10'
                            : `${accentClass ?? 'bg-ch-orange/10'} ${borderClass ?? 'border-ch-orange/20'}`
                    }`}
                >
                    {variant === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 text-ch-orange shrink-0" />
                    )}
                    {item}
                </div>
            ))}
        </div>
    );
}

function ActionPlanSection({ items, title }: { items: string[]; title: string }) {
    return (
        <div className="p-4 rounded-xl bg-ch-blue/5 border border-ch-blue/10">
            <h4 className="text-[10px] font-bold text-ch-blue uppercase tracking-widest mb-3 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" /> {title}
            </h4>
            <ul className="space-y-2">
                {items.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-ch-blue mt-2 shrink-0" />
                        {s}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function RulesSection({
    isBranding,
    brandingResults,
    perfResults,
    lastRulesCheck,
    expanded,
}: {
    isBranding: boolean;
    brandingResults: BrandingRuleRow[];
    perfResults: PerfRow[];
    lastRulesCheck?: RulesCheckResult | null;
    expanded: boolean;
}) {
    const hasBranding = isBranding && brandingResults.length > 0;
    const hasPerf = !isBranding && perfResults.length > 0;
    if (!hasBranding && !hasPerf) return null;

    const brandingToShow = expanded ? brandingResults : brandingResults.filter(r => !r.passed);
    const perfToShow = expanded ? perfResults : perfResults.filter(r => !r.passed);

    return (
        <div className="space-y-2">
            {hasBranding && (
                <>
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" /> Regras de branding
                        </h4>
                    {lastRulesCheck?.ai_summary && (
                        <p className="text-xs text-muted-foreground border-l-4 border-emerald-500/30 pl-3">{lastRulesCheck.ai_summary}</p>
                    )}
                    {brandingToShow.map((r, i) => (
                        <div
                            key={`b-${i}`}
                            className={`p-3 rounded-xl text-sm border ${r.passed ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}
                        >
                            <span className={`font-semibold ${r.passed ? 'text-emerald-400' : 'text-rose-400'}`}>{r.rule_name}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{r.reason}</p>
                        </div>
                    ))}
                </>
            )}

            {hasPerf && (
                <>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-3 h-3 text-amber-500" /> Regras de performance
                    </h4>
                    {perfToShow.map((r, i) => (
                        <div
                            key={`p-${i}`}
                            className={`p-3 rounded-xl text-sm border ${r.passed ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}
                        >
                            <span className={`font-semibold ${r.passed ? 'text-emerald-400' : 'text-rose-400'}`}>{r.rule_name}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{r.reason}</p>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

function SourcesCollapsible({
    creative,
    audit,
    creativeRules,
    auditFocus,
}: {
    creative: CreativeAuditReportDialogProps['creative'];
    audit: NonNullable<CreativeAuditReportDialogProps['audit']>;
    creativeRules?: Array<{ id: string; name: string }> | null;
    auditFocus: AuditFocus;
}) {
    return (
        <Collapsible className="pt-2 border-t border-border">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-2 text-left group">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Database className="w-3 h-3 text-ch-blue" /> Fontes da análise (técnico)
                </h4>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
                <SourcesBlock
                    creative={creative}
                    audit={audit}
                    creativeRules={creativeRules}
                    auditFocus={auditFocus}
                    hideHeader
                />
            </CollapsibleContent>
        </Collapsible>
    );
}

function SourcesBlock({
    creative,
    audit,
    creativeRules,
    auditFocus,
    hideHeader = false,
}: {
    creative: CreativeAuditReportDialogProps['creative'];
    audit: NonNullable<CreativeAuditReportDialogProps['audit']>;
    creativeRules?: Array<{ id: string; name: string }> | null;
    auditFocus: AuditFocus;
    hideHeader?: boolean;
}) {
    const isBranding = auditFocus === 'branding';
    const sources: { icon: typeof Type; label: string; detail: string }[] = [];
    const txt = (creative?.text || '').trim();
    if (txt) sources.push({ icon: Type, label: 'Texto principal', detail: txt.length > 80 ? `"${txt.slice(0, 80)}…" (${txt.length} chars)` : `"${txt}"` });
    else sources.push({ icon: Type, label: 'Texto principal', detail: 'Vazio — penalizado na avaliação' });

    const hl = (creative?.headline || '').trim();
    if (hl) sources.push({ icon: Type, label: 'Headline', detail: `"${hl}"` });

    const cta = (creative?.call_to_action || '').trim();
    sources.push({ icon: MousePointerClick, label: 'CTA', detail: cta || 'Nenhum' });

    if (creative?.image_url) sources.push({ icon: FileImage, label: 'Imagem', detail: 'Agente de visão (GPT-4o)' });
    if (creative?.video_url) sources.push({ icon: Film, label: 'Vídeo', detail: 'Thumbnail analisada' });

    const spend = Number(creative?.spend) || 0;
    const impressions = Number(creative?.impressions) || 0;
    const ctrM = Number(creative?.ctr) || 0;
    const cpcM = Number(creative?.cpc) || 0;
    if (!isBranding && (spend > 0 || impressions > 0)) {
        sources.push({
            icon: BarChart3,
            label: 'Métricas',
            detail: `${formatCurrency(spend)} · ${impressions.toLocaleString('pt-BR')} impr. · CTR ${ctrM.toFixed(2)}% · CPC ${formatCurrency(cpcM)}`,
        });
    }

    if (audit.policy_id) {
        sources.push({
            icon: ShieldCheck,
            label: 'Política',
            detail: isBranding ? 'Keywords e limites de texto' : 'Red flags de entrega e limites CTR/CPC',
        });
    }
    if (isBranding && creativeRules?.length) {
        sources.push({ icon: SearchCheck, label: 'Regras de branding', detail: `${creativeRules.length} ativa(s)` });
    }
    sources.push({ icon: BrainCircuit, label: 'Contexto IA', detail: 'Negócio, público e metas (Configurações → Contexto da IA)' });

    return (
        <div className={`space-y-2 ${hideHeader ? '' : 'pt-2 border-t border-border'}`}>
            {!hideHeader && (
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Database className="w-3 h-3 text-ch-blue" /> Fontes da análise
                </h4>
            )}
            <div className="space-y-2">
                {sources.map((src, i) => {
                    const Icon = src.icon;
                    return (
                        <div key={i} className="flex gap-2 p-2 rounded-lg bg-muted/40 border border-border/50 text-xs">
                            <Icon className="w-3.5 h-3.5 text-ch-blue shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold">{src.label}</p>
                                <p className="text-muted-foreground">{src.detail}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function CreativeRecommendationLink({ creativeId, name }: { creativeId: string; name?: string }) {
    return (
        <Link to={`/criativos/${creativeId}`} className="text-ch-orange hover:underline text-xs font-semibold">
            {name ? `Ver criativo: ${name}` : 'Ver criativo'}
        </Link>
    );
}
