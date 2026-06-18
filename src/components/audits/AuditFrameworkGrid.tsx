import {
    CheckCircle2,
    Eye,
    Fingerprint,
    MousePointerClick,
    ScanEye,
    Target,
    Zap,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { AiAnalysis } from '@/hooks/useAudits';
import { getScoreBarColor, getScoreColor } from '@/lib/audit-scores';

interface AuditFrameworkGridProps {
    ai: AiAnalysis;
    compact?: boolean;
}

const FRAMEWORKS = [
    { key: 'hook_score' as const, label: 'Hook Power', icon: Eye },
    { key: 'value_proposition_score' as const, label: 'Proposta de Valor', icon: Target },
    { key: 'persuasion_score' as const, label: 'Persuasão', icon: Fingerprint },
    { key: 'visual_score' as const, label: 'Design Visual', icon: ScanEye },
    { key: 'cta_score' as const, label: 'CTA', icon: MousePointerClick },
    { key: 'social_proof_score' as const, label: 'Prova Social', icon: CheckCircle2 },
    { key: 'urgency_score' as const, label: 'Urgência', icon: Zap },
    { key: 'target_alignment_score' as const, label: 'Target Fit', icon: Target },
];

export function AuditFrameworkGrid({ ai, compact = false }: AuditFrameworkGridProps) {
    const hasAnyScore = FRAMEWORKS.some(f => typeof ai[f.key] === 'number');
    if (!hasAnyScore) return null;

    return (
        <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Scores por framework
            </h4>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
                {FRAMEWORKS.map(({ key, label, icon: Icon }) => {
                    const score = ai[key] ?? 0;
                    return (
                        <div key={key} className={`space-y-1.5 rounded-xl bg-muted/30 ${compact ? 'p-3' : 'p-3'}`}>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Icon className="w-3 h-3" />
                                    {label}
                                </span>
                                <span className={`font-bold tabular-nums ${getScoreColor(score)}`}>{score}</span>
                            </div>
                            <Progress
                                value={score}
                                className="h-1.5 bg-background"
                                indicatorClassName={getScoreBarColor(score)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
