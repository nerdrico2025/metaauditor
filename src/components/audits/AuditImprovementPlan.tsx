import { Lightbulb, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ImprovementAction, ImprovementPriority } from '@/lib/audit-improvements';

interface AuditImprovementPlanProps {
    actions: ImprovementAction[];
}

const PRIORITY_LABELS: Record<ImprovementPriority, string> = {
    alta: 'Alta',
    media: 'Média',
    baixa: 'Baixa',
};

const PRIORITY_CLASSES: Record<ImprovementPriority, string> = {
    alta: 'bg-rose-500/10 text-rose-500 border-0',
    media: 'bg-amber-500/10 text-amber-500 border-0',
    baixa: 'bg-blue-500/10 text-blue-500 border-0',
};

export function AuditImprovementPlan({ actions }: AuditImprovementPlanProps) {
    if (actions.length === 0) return null;

    return (
        <div className="rounded-xl border-2 border-ch-orange/30 bg-ch-orange/5 p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-ch-orange uppercase tracking-widest flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5" />
                Como melhorar este criativo
            </h4>
            <p className="text-xs text-muted-foreground">
                Ações priorizadas com base no copy, nas métricas e nas regras configuradas.
            </p>

            <div className="space-y-2">
                {actions.map((action, index) => (
                    <div
                        key={action.id}
                        className="flex gap-3 p-3 rounded-xl bg-card border border-border text-sm"
                    >
                        <div className="flex flex-col items-center gap-1 shrink-0">
                            <span className="w-6 h-6 rounded-full bg-ch-orange/20 text-ch-orange text-xs font-bold flex items-center justify-center">
                                {index + 1}
                            </span>
                            <TrendingUp className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">{action.title}</p>
                                <Badge variant="outline" className={`text-[9px] ${PRIORITY_CLASSES[action.priority]}`}>
                                    {PRIORITY_LABELS[action.priority]}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
