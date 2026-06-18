import { BarChart3, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AiAnalysis } from '@/hooks/useAudits';
import type { AuditFocus } from '@/lib/audit-focus';
import { getScalingBadge } from '@/lib/audit-scores';

interface AuditMarketingSummaryProps {
    ai: AiAnalysis;
    auditFocus: AuditFocus;
}

export function AuditMarketingSummary({ ai, auditFocus }: AuditMarketingSummaryProps) {
    const isBranding = auditFocus === 'branding';
    const scalingBadge = !isBranding ? getScalingBadge(ai.scaling_recommendation) : null;
    const policyWarnings = ai.policy_warnings?.filter(Boolean) ?? [];

    const hasContent =
        (!isBranding && !!ai.performance_diagnosis) ||
        !!scalingBadge ||
        (isBranding && policyWarnings.length > 0);

    if (!hasContent) return null;

    return (
        <div className="rounded-xl border border-ch-orange/20 bg-ch-orange/5 p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-ch-orange uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                Insights de marketing
            </h4>

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
