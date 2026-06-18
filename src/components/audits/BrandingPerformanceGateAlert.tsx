import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    brandingGateBannerCopy,
    brandingGateStatusLabel,
} from '@/lib/brandingPerformanceGate';
import type { CrossFocusDisplayStatus } from '@/lib/crossFocusAudit';
import { cn } from '@/lib/utils';

interface BrandingPerformanceGateAlertProps {
    brandingStatus: CrossFocusDisplayStatus;
    onGoToBranding: () => void;
    className?: string;
}

export function BrandingPerformanceGateAlert({
    brandingStatus,
    onGoToBranding,
    className,
}: BrandingPerformanceGateAlertProps) {
    const copy = brandingGateBannerCopy(brandingStatus);
    if (!copy) return null;

    const statusLabel = brandingGateStatusLabel(brandingStatus);

    return (
        <div
            role="alert"
            className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5',
                className,
            )}
        >
            <div className="flex items-start gap-3 min-w-0">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{copy.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{copy.description}</p>
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        Status atual: {statusLabel}
                    </p>
                </div>
            </div>
            <Button
                type="button"
                size="sm"
                onClick={onGoToBranding}
                className="shrink-0 bg-ch-orange hover:bg-ch-orange-hover text-white font-bold rounded-xl"
            >
                {copy.ctaLabel}
                <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
        </div>
    );
}
