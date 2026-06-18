import { ScanEye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AiAnalysis } from '@/hooks/useAudits';

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
    const va = ai?.visual_analysis;

    return (
        <div className={`space-y-3 ${compact ? '' : 'p-6 rounded-2xl border border-border bg-card'}`}>
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

            {!va ? (
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
                <div className="space-y-4">
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
