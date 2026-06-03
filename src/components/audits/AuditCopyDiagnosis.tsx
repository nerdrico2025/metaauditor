import { AlertTriangle, CheckCircle, FileText, XCircle } from 'lucide-react';
import { buildCopyChecks, type CopyCheckStatus } from '@/lib/audit-improvements';

interface AuditCopyDiagnosisProps {
    creative: {
        text?: string | null;
        headline?: string | null;
        description?: string | null;
        call_to_action?: string | null;
        image_url?: string | null;
        video_url?: string | null;
    } | null | undefined;
}

function StatusIcon({ status }: { status: CopyCheckStatus }) {
    if (status === 'ok') return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (status === 'error') return <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
    return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
}

function statusBorderClass(status: CopyCheckStatus): string {
    if (status === 'ok') return 'bg-emerald-500/5 border-emerald-500/10';
    if (status === 'error') return 'bg-rose-500/5 border-rose-500/10';
    return 'bg-amber-500/5 border-amber-500/10';
}

export function AuditCopyDiagnosis({ creative }: AuditCopyDiagnosisProps) {
    const checks = buildCopyChecks(creative);
    const hasIssues = checks.some(c => c.status !== 'ok');

    return (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-3 h-3 text-ch-blue" />
                Diagnóstico do copy
            </h4>

            {!hasIssues ? (
                <p className="text-sm text-emerald-500 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Copy básico em ordem. Veja abaixo como otimizar conversão e performance.
                </p>
            ) : null}

            <div className="space-y-2">
                {checks.map(check => (
                    <div
                        key={check.id}
                        className={`flex gap-3 p-3 rounded-xl text-sm border ${statusBorderClass(check.status)}`}
                    >
                        <StatusIcon status={check.status} />
                        <div className="min-w-0">
                            <p className="font-semibold text-foreground">{check.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{check.message}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
