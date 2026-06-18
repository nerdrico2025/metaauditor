import { CheckCircle2, Fingerprint, TrendingDown, TrendingUp, XCircle } from 'lucide-react';
import type { AiAnalysis } from '@/hooks/useAudits';

interface AuditPersuasionSectionProps {
    ai: AiAnalysis | null;
    compact?: boolean;
    emptyMessage?: string;
}

export function AuditPersuasionSection({
    ai,
    compact = false,
    emptyMessage = 'Insights de marketing não disponíveis nesta análise. Use Reanalise para gerar.',
}: AuditPersuasionSectionProps) {
    const found = ai?.persuasion_triggers_found ?? [];
    const missing = ai?.persuasion_triggers_missing ?? [];
    const hasContent = found.length > 0 || missing.length > 0;

    return (
        <div className={`space-y-3 ${compact ? '' : 'p-6 rounded-2xl border border-border bg-card'}`}>
            <div className="flex items-center gap-2">
                <Fingerprint className={`${compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-indigo-400`} />
                <div>
                    <h4 className={`font-bold text-foreground ${compact ? 'text-xs' : 'text-base'}`}>
                        Psicologia e persuasão
                    </h4>
                    {!compact && (
                        <p className="text-xs text-muted-foreground">Gatilhos de Cialdini e viés cognitivo</p>
                    )}
                </div>
            </div>

            {!hasContent ? (
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
                <div className="space-y-3">
                    {found.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> Gatilhos detectados
                            </p>
                            {found.map((trigger, i) => (
                                <div key={i} className="flex gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-sm">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    {trigger}
                                </div>
                            ))}
                        </div>
                    )}
                    {missing.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                <TrendingDown className="w-3 h-3" /> Gatilhos ausentes
                            </p>
                            {missing.map((item, i) => (
                                <div key={i} className="flex gap-2 p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-sm">
                                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    {item}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
