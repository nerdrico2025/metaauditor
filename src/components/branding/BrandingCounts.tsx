import { CheckCircle2, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandingComplianceCounts } from '@/hooks/useBrandingCompliance';

interface Props {
    counts: BrandingComplianceCounts | undefined;
    /** Compact = inline pills for lists; default = bigger badges. */
    variant?: 'default' | 'compact';
    /** Hide the "pendente" group when there's none — usually true. */
    hidePendingWhenZero?: boolean;
    className?: string;
}

/**
 * Branding compliance badges per row (briefing #3): "verde = aprovado, vermelho = reprovado".
 * Used in Campanhas / Conjuntos branding mode and in Criativos summary header.
 */
export function BrandingCounts({ counts, variant = 'default', hidePendingWhenZero = true, className }: Props) {
    if (!counts) {
        return (
            <div className={cn('text-xs text-muted-foreground/60 italic', className)}>—</div>
        );
    }
    const { total_creatives, approved, rejected, not_checked } = counts;
    const isCompact = variant === 'compact';

    if (total_creatives === 0) {
        return (
            <div className={cn('text-xs text-muted-foreground/60 italic', className)}>
                sem criativos
            </div>
        );
    }

    const pillBase = isCompact
        ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold'
        : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold';

    return (
        <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
            <span className={cn(pillBase, 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20')}>
                <CheckCircle2 className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                {approved}
            </span>
            <span className={cn(pillBase, 'bg-red-500/10 text-red-500 border border-red-500/20')}>
                <XCircle className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                {rejected}
            </span>
            {!(hidePendingWhenZero && not_checked === 0) && (
                <span className={cn(pillBase, 'bg-muted text-muted-foreground border border-border')}>
                    <Circle className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                    {not_checked}
                </span>
            )}
            <span className={cn('text-[10px] text-muted-foreground ml-1', isCompact && 'hidden sm:inline')}>
                de {total_creatives}
            </span>
        </div>
    );
}
