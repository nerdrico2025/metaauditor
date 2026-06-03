import { ScanEye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { AiAnalysis } from '@/hooks/useAudits';
import { getScoreBarColor, getScoreBgColor, getScoreColor, getScoreLabel } from '@/lib/audit-scores';

interface AuditVisualSectionProps {
    ai: AiAnalysis | null;
    compact?: boolean;
    emptyMessage?: string;
}

export function AuditVisualSection({
    ai,
    compact = false,
    emptyMessage = 'Insights de marketing não disponíveis nesta análise. Use Reanalise para gerar.',
}: AuditVisualSectionProps) {
    const visualScore = ai?.visual_score ?? 0;
    const va = ai?.visual_analysis;

    return (
        <div className={`space-y-3 ${compact ? '' : 'p-6 rounded-2xl border border-border bg-card'}`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <ScanEye className={`${compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-blue-400`} />
                    <div>
                        <h4 className={`font-bold text-foreground ${compact ? 'text-xs' : 'text-base'}`}>
                            Arquitetura visual
                        </h4>
                        {!compact && (
                            <p className="text-xs text-muted-foreground">Composição, hierarquia e legibilidade</p>
                        )}
                    </div>
                </div>
                {ai && typeof ai.visual_score === 'number' && (
                    <Badge variant="outline" className={`${getScoreBgColor(visualScore)} ${getScoreColor(visualScore)} border-0 text-[10px]`}>
                        {getScoreLabel(visualScore)} {visualScore}/100
                    </Badge>
                )}
            </div>

            {!va ? (
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
                <div className="space-y-4">
                    {[
                        { label: 'Contraste e legibilidade', value: va.contrast_readability ?? 0 },
                        { label: 'Hierarquia da informação', value: va.information_hierarchy ?? 0 },
                        { label: 'Otimização mobile', value: va.mobile_optimization ?? 0 },
                    ].map(row => (
                        <div key={row.label} className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="font-medium text-muted-foreground">{row.label}</span>
                                <Badge variant="outline" className={`${getScoreBgColor(row.value)} ${getScoreColor(row.value)} border-0 text-[10px] px-2`}>
                                    {getScoreLabel(row.value)}
                                </Badge>
                            </div>
                            <Progress value={row.value} className="h-1.5 bg-background" indicatorClassName={getScoreBarColor(row.value)} />
                        </div>
                    ))}

                    <div className="flex flex-wrap gap-2">
                        {va.text_overlay_ratio && (
                            <Badge variant="outline" className="text-[10px] border-border bg-card">
                                Texto: {va.text_overlay_ratio}
                            </Badge>
                        )}
                        {va.has_human_face !== undefined && (
                            <Badge
                                variant="outline"
                                className={`text-[10px] border-0 ${va.has_human_face ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}
                            >
                                {va.has_human_face ? 'Rosto humano presente' : 'Sem rosto humano'}
                            </Badge>
                        )}
                    </div>

                    {va.composition_notes && (
                        <div className="p-3 rounded-xl bg-muted/30 border border-border">
                            <p className="text-xs text-muted-foreground leading-relaxed">{va.composition_notes}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
