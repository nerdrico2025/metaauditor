import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-react';
import type { AuditFocus } from '@/lib/audit-focus';
import { crossFocusCardMessage, type CrossFocusDisplayStatus } from '@/lib/crossFocusAudit';
import { BRANDING_GATE_BLOCK_MSG } from '@/lib/brandingPerformanceGate';
import { cn } from '@/lib/utils';

interface CrossFocusStatusCardProps {
    oppositeFocus: AuditFocus;
    status: CrossFocusDisplayStatus;
    analyzedAt?: string | null;
    className?: string;
}

export function CrossFocusStatusCard({
    oppositeFocus,
    status,
    analyzedAt,
    className,
}: CrossFocusStatusCardProps) {
    const message =
        crossFocusCardMessage(oppositeFocus, status)
        ?? (status === 'none' && oppositeFocus === 'branding' ? BRANDING_GATE_BLOCK_MSG : null);
    if (!message) return null;

    const SectorIcon = oppositeFocus === 'branding' ? ShieldCheck : Activity;
    const isApproved = status === 'approved';
    const isWarning = status === 'warning' || (status === 'none' && oppositeFocus === 'branding');

    return (
        <div
            className={cn(
                'flex items-center gap-4 p-4 rounded-2xl border',
                isApproved
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : isWarning
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-rose-500/10 border-rose-500/30',
                className,
            )}
        >
            {isApproved ? (
                <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            ) : (
                <AlertTriangle
                    className={cn(
                        'w-6 h-6 flex-shrink-0',
                        isWarning ? 'text-amber-500' : 'text-rose-500',
                    )}
                />
            )}
            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        'text-sm font-bold flex items-center gap-2',
                        isApproved
                            ? 'text-emerald-500'
                            : isWarning
                                ? 'text-amber-500'
                                : 'text-rose-500',
                    )}
                >
                    <SectorIcon className="w-4 h-4 opacity-80" />
                    {message}
                </p>
                {analyzedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Última análise em{' '}
                        {format(new Date(analyzedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                )}
            </div>
        </div>
    );
}
