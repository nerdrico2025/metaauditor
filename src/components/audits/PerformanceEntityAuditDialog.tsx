import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Audit, AiAnalysis } from '@/hooks/useAudits';

interface RollupRow {
    rule_name: string;
    passed: boolean;
    reason: string;
    violating_creative_count?: number;
    violating_creative_names?: string[];
}

interface PerformanceEntityAuditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    audit: Audit | null;
    entityName: string;
    entityLevel: 'campaign' | 'ad_set';
    onReanalyze?: () => void;
    isReanalyzing?: boolean;
    viewCreativesHref?: string;
}

export function PerformanceEntityAuditDialog({
    open,
    onOpenChange,
    audit,
    entityName,
    entityLevel,
    onReanalyze,
    isReanalyzing,
    viewCreativesHref,
}: PerformanceEntityAuditDialogProps) {
    if (!audit) return null;

    const focus = 'performance' as const;
    const isApproved = audit.status === 'approved';
    const isRejected = audit.status === 'rejected';
    const textAccent = isRejected ? 'text-rose-500' : isApproved ? 'text-emerald-500' : 'text-ch-orange';
    const analysis = (audit.ai_analysis ?? {}) as AiAnalysis & {
        performance_rules_rollup?: RollupRow[];
        action_plan?: string[];
    };

    const perfRules = analysis.performance_rules_compliance ?? [];
    const rollup = analysis.performance_rules_rollup ?? [];
    const strengths = analysis.strengths ?? [];
    const weaknesses = analysis.weaknesses ?? [];
    const actionPlan = analysis.action_plan ?? analysis.suggestions ?? audit.recommendations ?? [];

    const levelLabel = entityLevel === 'campaign' ? 'Campanha' : 'Conjunto';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[min(90vh,800px)] flex flex-col p-0 overflow-hidden rounded-2xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>Diagnóstico de performance — {entityName}</DialogTitle>
                    <DialogDescription>Análise IA e regras de performance agregadas.</DialogDescription>
                </DialogHeader>

                <div className="shrink-0 px-6 py-5 border-b border-border bg-gradient-to-br from-primary/10 to-background">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <BrainCircuit className={`w-5 h-5 ${textAccent}`} />
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                                {levelLabel}
                            </Badge>
                            <Badge
                                variant="outline"
                                className={`text-[10px] uppercase tracking-wider ${
                                    isApproved
                                        ? 'border-emerald-500/30 text-emerald-500'
                                        : isRejected
                                            ? 'border-rose-500/30 text-rose-500'
                                            : 'border-amber-500/30 text-amber-500'
                                }`}
                            >
                                {isApproved ? 'Aprovado' : isRejected ? 'Reprovado' : 'Revisão pendente'}
                            </Badge>
                        </div>
                        <h2 className="text-lg font-bold truncate">{entityName}</h2>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {analysis.executive_summary || analysis.tone_analysis || 'Diagnóstico de performance'}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                            Regras de performance (agregado)
                        </h3>
                        {perfRules.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma regra ativa configurada.</p>
                        ) : (
                            <ul className="space-y-2">
                                {(rollup.length ? rollup : perfRules).map((row) => (
                                    <li
                                        key={row.rule_name}
                                        className="flex gap-2 text-sm rounded-lg border border-border p-3 bg-muted/30"
                                    >
                                        {row.passed
                                            ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                            : <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                                        <div className="min-w-0">
                                            <p className="font-medium">{row.rule_name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{row.reason}</p>
                                            {'violating_creative_count' in row && (Number((row as any).violating_creative_count) || 0) > 0 && (
                                                <p className="text-xs text-rose-600/90 mt-1">
                                                    {(row as any).violating_creative_count} criativo(s):{' '}
                                                    {((row as any).violating_creative_names ?? []).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {(strengths.length > 0 || weaknesses.length > 0) && (
                        <section className="grid sm:grid-cols-2 gap-4">
                            {strengths.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">Pontos fortes</h3>
                                    <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                                        {strengths.map((s) => <li key={s}>{s}</li>)}
                                    </ul>
                                </div>
                            )}
                            {weaknesses.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-2">Atenção</h3>
                                    <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                                        {weaknesses.map((w) => <li key={w}>{w}</li>)}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}

                    {actionPlan.length > 0 && (
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                Plano de ação
                            </h3>
                            <ol className="text-sm space-y-2 list-decimal list-inside text-foreground">
                                {actionPlan.map((item) => (
                                    <li key={String(item)} className="pl-1">{typeof item === 'string' ? item : String(item)}</li>
                                ))}
                            </ol>
                        </section>
                    )}
                </div>

                <DialogFooter className="shrink-0 px-6 py-4 border-t border-border flex-row flex-wrap gap-2 sm:justify-between">
                    <div className="flex gap-2">
                        {viewCreativesHref && (
                            <Button variant="outline" size="sm" asChild>
                                <Link to={viewCreativesHref}>Ver criativos</Link>
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {onReanalyze && (
                            <Button variant="outline" size="sm" onClick={onReanalyze} disabled={isReanalyzing}>
                                {isReanalyzing ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                ) : (
                                    <RefreshCw className="w-4 h-4 mr-1.5" />
                                )}
                                Reanalisar
                            </Button>
                        )}
                        <Button size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
