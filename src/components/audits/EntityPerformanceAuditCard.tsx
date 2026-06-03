import { BrainCircuit, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLatestEntityAudit, useEntityAudit } from '@/hooks/useEntityAudit';
import { PerformanceEntityAuditDialog } from '@/components/audits/PerformanceEntityAuditDialog';
import { primaryAuditScore } from '@/lib/audit-focus';
import { criativosPath } from '@/lib/campaignNavigation';
import { useState } from 'react';
import type { Audit } from '@/hooks/useAudits';

interface EntityPerformanceAuditCardProps {
    entityId: string;
    entityName: string;
    level: 'campaign' | 'ad_set';
    campaignId?: string;
}

export function EntityPerformanceAuditCard({
    entityId,
    entityName,
    level,
    campaignId,
}: EntityPerformanceAuditCardProps) {
    const { data: latestAudit, isLoading } = useLatestEntityAudit(entityId, level);
    const { runCampaignAudit, runAdSetAudit } = useEntityAudit();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [activeAudit, setActiveAudit] = useState<Audit | null>(null);

    const pending = level === 'campaign' ? runCampaignAudit.isPending : runAdSetAudit.isPending;
    const displayAudit = activeAudit ?? latestAudit ?? null;
    const score = displayAudit ? primaryAuditScore(displayAudit, 'performance') : null;
    const summary = (displayAudit?.ai_analysis as { executive_summary?: string } | null)?.executive_summary;

    const runAnalysis = async (forceRefresh?: boolean) => {
        try {
            const result = level === 'campaign'
                ? await runCampaignAudit.mutateAsync({ campaignId: entityId, forceRefresh })
                : await runAdSetAudit.mutateAsync({ adSetId: entityId, forceRefresh });
            setActiveAudit(result.audit);
            setDialogOpen(true);
        } catch {
            /* toast via hook */
        }
    };

    return (
        <>
            <div className="p-1 rounded-[2rem] border border-border bg-card">
                <div className="bg-card rounded-[1.9rem] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
                                <Sparkles className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground tracking-tight">Diagnóstico de Performance</h2>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                                    {level === 'campaign' ? 'Visão estratégica' : 'Visão tática do conjunto'}
                                </p>
                            </div>
                        </div>
                        {score != null && (
                            <Badge variant="outline" className="font-bold tabular-nums">{score}%</Badge>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Carregando último diagnóstico…
                        </div>
                    ) : displayAudit ? (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
                            {summary || 'Análise de performance disponível. Abra o relatório completo para ver regras e plano de ação.'}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                            Nenhuma análise de performance registrada para esta {level === 'campaign' ? 'campanha' : 'conjunto'} no período recente.
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => void runAnalysis()} disabled={pending}>
                            {pending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <BrainCircuit className="w-4 h-4 mr-1.5" />}
                            {displayAudit ? 'Atualizar análise' : 'Executar análise IA'}
                        </Button>
                        {displayAudit && (
                            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                                Ver relatório
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <PerformanceEntityAuditDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                audit={displayAudit}
                entityName={entityName}
                entityLevel={level}
                viewCreativesHref={
                    level === 'campaign'
                        ? criativosPath({ campaignId: entityId })
                        : criativosPath({ adSetId: entityId, campaignId })
                }
                onReanalyze={() => void runAnalysis(true)}
                isReanalyzing={pending}
            />
        </>
    );
}
