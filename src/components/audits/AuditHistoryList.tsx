import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    AlertTriangle,
    CheckCircle,
    ChevronRight,
    Clock,
    FileImage,
    Loader2,
    BrainCircuit,
    Target,
    XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Audit } from '@/hooks/useAudits';
import {
    auditFocusLabel,
    resolveAuditFocus,
    type AuditFocus,
} from '@/lib/audit-focus';
import { getProxiedImageUrl } from '@/lib/utils';
export type HistoryEntryKind = 'creative' | 'campaign' | 'ad_set';

export interface AuditHistoryListEntry {
    audit: Audit;
    kind: HistoryEntryKind;
}

export function getHistoryEntryKind(audit: Audit): HistoryEntryKind {
    if (audit.audit_level === 'campaign') return 'campaign';
    if (audit.audit_level === 'ad_set') return 'ad_set';
    return 'creative';
}

export function getHistoryEntryName(audit: Audit): string {
    if (audit.audit_level === 'campaign') return audit.campaigns?.name ?? 'Campanha';
    if (audit.audit_level === 'ad_set') return audit.ad_sets?.name ?? 'Conjunto';
    return audit.creatives?.name ?? 'Sem nome';
}

function historyKindLabel(kind: HistoryEntryKind): string {
    if (kind === 'campaign') return 'Campanha';
    if (kind === 'ad_set') return 'Conjunto';
    return 'Anúncio';
}

export function StatusBadge({ status }: { status: string | null }) {
    if (status === 'approved') {
        return (
            <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 gap-1.5 font-bold text-[10px] uppercase tracking-widest">
                <CheckCircle className="w-3 h-3" /> Aprovado
            </Badge>
        );
    }
    if (status === 'rejected') {
        return (
            <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20 gap-1.5 font-bold text-[10px] uppercase tracking-widest">
                <XCircle className="w-3 h-3" /> Rejeitado
            </Badge>
        );
    }
    if (status === 'pending') {
        return (
            <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 gap-1.5 font-bold text-[10px] uppercase tracking-widest">
                <AlertTriangle className="w-3 h-3" /> Pendente
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="gap-1.5 font-bold text-[10px] uppercase tracking-widest">
            <Clock className="w-3 h-3" /> {status || '—'}
        </Badge>
    );
}

interface AuditHistoryListProps {
    entries: AuditHistoryListEntry[];
    isLoading?: boolean;
    selectedId?: string | null;
    showEntityBadges?: boolean;
    showCreativeName?: boolean;
    showSpend?: boolean;
    auditFocus: AuditFocus;
    onSelect: (entry: AuditHistoryListEntry) => void;
    emptyState?: React.ReactNode;
}

export function AuditHistoryList({
    entries,
    isLoading = false,
    selectedId,
    showEntityBadges = false,
    showCreativeName = true,
    showSpend = false,
    auditFocus,
    onSelect,
    emptyState,
}: AuditHistoryListProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-ch-orange" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                    Carregando histórico...
                </p>
            </div>
        );
    }

    if (entries.length === 0) {
        if (emptyState) return <>{emptyState}</>;
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                    <BrainCircuit className="w-7 h-7 text-muted-foreground opacity-40" />
                </div>
                <p className="text-sm font-bold text-foreground">Nenhuma auditoria de IA encontrada</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                    Rode um diagnóstico em qualquer criativo para começar.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {entries.map((entry) => {
                const { audit, kind } = entry;
                const focus = resolveAuditFocus(audit);
                const date = audit.created_at
                    ? format(new Date(audit.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })
                    : '';
                const thumb = kind === 'creative' ? audit.creatives?.image_url : null;
                const auditTypeLabel = auditFocusLabel(focus);
                const auditSpend = audit.creatives?.spend ?? 0;
                const isSelected = selectedId === audit.id;
                const displayName = getHistoryEntryName(audit);

                return (
                    <button
                        key={audit.id}
                        type="button"
                        onClick={() => onSelect(entry)}
                        className={`w-full text-left bg-card border rounded-2xl p-4 transition-all group ${
                            isSelected
                                ? 'border-ch-orange/40 bg-ch-orange/5 ring-1 ring-ch-orange/20'
                                : 'border-border hover:border-ch-orange/40 hover:bg-muted/40'
                        }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted border border-border flex-shrink-0">
                                {kind === 'creative' && thumb ? (
                                    <img
                                        src={
                                            getProxiedImageUrl(thumb, audit.creatives?.external_id || null) || thumb
                                        }
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ) : kind !== 'creative' ? (
                                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                        <Target className="w-5 h-5 text-primary" />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <FileImage className="w-5 h-5 text-muted-foreground/40" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="min-w-0 flex-1">
                                        {showCreativeName && (
                                            <h4
                                                className={`text-sm font-bold truncate transition-colors ${
                                                    isSelected
                                                        ? 'text-ch-orange'
                                                        : 'text-foreground group-hover:text-ch-orange'
                                                }`}
                                            >
                                                {displayName}
                                            </h4>
                                        )}
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                            {auditTypeLabel} · {date}
                                            {showSpend && kind === 'creative' && auditSpend > 0 && (
                                                <span className="ml-2 normal-case">
                                                    · R${auditSpend.toFixed(2)}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground group-hover:text-ch-orange group-hover:translate-x-0.5 transition-all" />
                                </div>

                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <StatusBadge status={audit.status} />
                                    {showEntityBadges && (
                                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider px-1.5 py-0">
                                            {historyKindLabel(kind)}
                                        </Badge>
                                    )}
                                    <Badge
                                        variant="outline"
                                        className={`text-[10px] font-bold uppercase tracking-widest ${
                                            focus === 'branding'
                                                ? 'border-violet-500/30 text-violet-500'
                                                : 'border-ch-orange/30 text-ch-orange'
                                        }`}
                                    >
                                        {focus === 'branding' ? 'Branding' : 'Performance'}
                                    </Badge>
                                    {audit.policies?.name && (
                                        <span className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 rounded-md bg-muted/60">
                                            {audit.policies.name}
                                        </span>
                                    )}
                                </div>

                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
