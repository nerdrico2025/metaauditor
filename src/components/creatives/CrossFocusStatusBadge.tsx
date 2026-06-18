import { Activity, AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-react';
import type { AuditFocus } from '@/lib/audit-focus';
import { crossFocusStatusLabel, type CrossFocusDisplayStatus } from '@/lib/crossFocusAudit';
import { brandingGatePendingBadgeLabel } from '@/lib/brandingPerformanceGate';
import { cn } from '@/lib/utils';

interface CrossFocusStatusBadgeProps {
    oppositeFocus: AuditFocus;
    status: CrossFocusDisplayStatus;
    className?: string;
}

export function CrossFocusStatusBadge({
    oppositeFocus,
    status,
    className,
}: CrossFocusStatusBadgeProps) {
    const label =
        crossFocusStatusLabel(oppositeFocus, status)
        ?? (status === 'none' && oppositeFocus === 'branding' ? brandingGatePendingBadgeLabel() : null);
    if (!label) return null;

    const Icon = oppositeFocus === 'branding' ? ShieldCheck : Activity;
    const StatusIcon =
        status === 'approved'
            ? CheckCircle
            : status === 'none' && oppositeFocus === 'branding'
                ? ShieldCheck
                : AlertTriangle;

    const colorClasses =
        status === 'approved'
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            : status === 'warning' || (status === 'none' && oppositeFocus === 'branding')
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                : 'bg-rose-500/10 text-rose-500 border-rose-500/20';

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border',
                colorClasses,
                className,
            )}
        >
            <Icon className="w-3 h-3 opacity-70" />
            <StatusIcon className="w-3 h-3" />
            {label}
        </span>
    );
}
