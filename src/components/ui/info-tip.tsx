import { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface InfoTipProps {
    /** Bold title shown on the first line (usually the feature name). Optional. */
    title?: string;
    /** Short explanation of what this control does. */
    hint: ReactNode;
    /** The element the tooltip is attached to (must be a single ref-forwarding element). */
    children: ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
    delayDuration?: number;
}

/**
 * Explanatory hover tooltip — the same "balãozinho" pattern used by the Dashboard KPIs:
 * a bold title + a short description. Wrap any control with it to explain what it does.
 *
 *   <InfoTip title="Sincronizar" hint="Puxa os dados mais recentes da Meta.">
 *     <Button>Sincronizar</Button>
 *   </InfoTip>
 *
 * Relies on the global <TooltipProvider /> already mounted in App.tsx.
 */
export function InfoTip({ title, hint, children, side = 'bottom', delayDuration = 300 }: InfoTipProps) {
    if (!hint) return <>{children}</>;
    return (
        <Tooltip delayDuration={delayDuration}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
                {title && <p className="font-semibold mb-1">{title}</p>}
                <p className="text-muted-foreground">{hint}</p>
            </TooltipContent>
        </Tooltip>
    );
}
