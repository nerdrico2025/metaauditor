import { BarChart3, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { AiAnalysis } from '@/hooks/useAudits';
import type { AuditFocus } from '@/lib/audit-focus';
import { getScoreBarColor, getScoreColor, getScalingBadge } from '@/lib/audit-scores';

interface AuditMarketingSummaryProps {
    ai: AiAnalysis;
    auditFocus: AuditFocus;
}

export function AuditMarketingSummary({ ai, auditFocus }: AuditMarketingSummaryProps) {
    const isBranding = auditFocus === 'branding';
    const hasAiData = typeof ai.overall_score === 'number';

    if (!hasAiData) return null;

    const miniScores = isBranding
        ? [
            { label: 'Visual', score: ai.visual_score ?? 0 },
            { label: 'Persuasão', score: ai.persuasion_score ?? 0 },
            { label: 'Proposta de valor', score: ai.value_proposition_score ?? 0 },
        ]
        : [
            { label: 'Hook', score: ai.hook_score ?? 0 },
            { label: 'Proposta de valor', score: ai.value_proposition_score ?? 0 },
            { label: 'Persuasão', score: ai.persuasion_score ?? 0 },
        ];

    const scalingBadge = !isBranding ? getScalingBadge(ai.scaling_recommendation) : null;
    const policyWarnings = ai.policy_warnings?.filter(Boolean) ?? [];

    return (
        <div className="rounded-xl border border-ch-orange/20 bg-ch-orange/5 p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-ch-orange uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                Insights de marketing
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {miniScores.map(item => (
                    <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className={`font-bold tabular-nums ${getScoreColor(item.score)}`}>{item.score}</span>
                        </div>
                        <Progress value={item.score} className="h-1 bg-background" indicatorClassName={getScoreBarColor(item.score)} />
                    </div>
                ))}
            </div>

            {!isBranding && ai.performance_diagnosis && (
                <div className="flex gap-2 text-sm">
                    <BarChart3 className="w-4 h-4 text-ch-orange shrink-0 mt-0.5" />
                    <p className="text-foreground/80 leading-relaxed">{ai.performance_diagnosis}</p>
                </div>
            )}

            {scalingBadge && (
                <Badge variant="outline" className={`${scalingBadge.color} border-0 text-xs`}>
                    {scalingBadge.label}
                </Badge>
            )}

            {isBranding && policyWarnings.length > 0 && (
                <ul className="space-y-1 text-sm text-muted-foreground">
                    {policyWarnings.slice(0, 3).map((w, i) => (
                        <li key={i} className="flex gap-2">
                            <span className="text-ch-orange">•</span>
                            {w}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
