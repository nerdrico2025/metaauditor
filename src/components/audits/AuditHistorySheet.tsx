import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, BrainCircuit, CheckCircle, AlertTriangle, XCircle, Clock, Loader2, FileImage, ChevronRight } from 'lucide-react';
import { useAudits } from '@/hooks/useAudits';
import { auditFocusLabel, moduleToAuditFocus, primaryAuditScore, resolveAuditFocus } from '@/lib/audit-focus';
import { useModule } from '@/contexts/ModuleContext';
import { getProxiedImageUrl } from '@/lib/utils';

interface AuditHistorySheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    creativeId?: string;
    title?: string;
}

function StatusBadge({ status }: { status: string | null }) {
    if (status === 'approved') return (
        <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 gap-1.5 font-bold text-[10px] uppercase tracking-widest">
            <CheckCircle className="w-3 h-3" /> Aprovado
        </Badge>
    );
    if (status === 'rejected') return (
        <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20 gap-1.5 font-bold text-[10px] uppercase tracking-widest">
            <XCircle className="w-3 h-3" /> Rejeitado
        </Badge>
    );
    if (status === 'pending') return (
        <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 gap-1.5 font-bold text-[10px] uppercase tracking-widest">
            <AlertTriangle className="w-3 h-3" /> Pendente
        </Badge>
    );
    return (
        <Badge variant="outline" className="gap-1.5 font-bold text-[10px] uppercase tracking-widest">
            <Clock className="w-3 h-3" /> {status || '—'}
        </Badge>
    );
}

export function AuditHistorySheet({ open, onOpenChange, creativeId, title }: AuditHistorySheetProps) {
    const navigate = useNavigate();
    const { module } = useModule();
    const auditFocus = moduleToAuditFocus(module);
    const { audits, isLoading } = useAudits(auditFocus);

    const filtered = useMemo(() => {
        if (!creativeId) return audits;
        return audits.filter(a => a.creative_id === creativeId);
    }, [audits, creativeId]);

    const headerTitle = title || (creativeId ? 'Histórico de Auditoria IA' : 'Histórico de Auditoria IA');
    const headerDescription = creativeId
        ? `Diagnósticos de IA deste criativo (${auditFocusLabel(auditFocus)}). Reprovados por regras de branding ficam em Anúncios.`
        : `Diagnósticos de IA salvos — foco ${auditFocusLabel(auditFocus).toLowerCase()}. Clique para abrir o criativo.`;

    const handleOpenCreative = (id: string) => {
        navigate(`/criativos/${id}`);
        onOpenChange(false);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-2xl bg-background border-l border-border p-0 flex flex-col">
                <SheetHeader className="p-6 border-b border-border bg-muted/30">
                    <SheetTitle className="flex items-center gap-3 text-xl font-bold">
                        <div className="p-2 bg-ch-orange/10 rounded-xl">
                            <History className="w-5 h-5 text-ch-orange" />
                        </div>
                        {headerTitle}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-muted-foreground">
                        {headerDescription}
                    </SheetDescription>
                </SheetHeader>

                <ScrollArea className="flex-1 px-6 py-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-ch-orange" />
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Carregando histórico...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                                <BrainCircuit className="w-7 h-7 text-muted-foreground opacity-40" />
                            </div>
                            <p className="text-sm font-bold text-foreground">Nenhuma auditoria de IA encontrada</p>
                            <p className="text-xs text-muted-foreground max-w-sm">
                                {creativeId
                                    ? 'Este criativo ainda não passou por diagnóstico de IA.'
                                    : 'Rode um diagnóstico em qualquer criativo para começar.'}
                            </p>
                            <p className="text-xs text-muted-foreground max-w-sm mt-2">
                                Reprovados por <strong>regras de branding</strong> aparecem em{' '}
                                <button
                                    type="button"
                                    className="text-ch-orange hover:underline font-semibold"
                                    onClick={() => {
                                        navigate('/anuncios?status=rejected');
                                        onOpenChange(false);
                                    }}
                                >
                                    Anúncios → Reprovados
                                </button>
                                .
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filtered.map((audit) => {
                                const focus = resolveAuditFocus(audit);
                                const score = primaryAuditScore(audit, focus);
                                const scoreColor = score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-rose-500';
                                const date = audit.created_at ? format(new Date(audit.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR }) : '';
                                const thumb = audit.creatives?.image_url;
                                const auditTypeLabel = auditFocusLabel(focus);
                                const previewWeakness = audit.ai_analysis?.weaknesses?.[0];
                                const previewStrength = audit.ai_analysis?.strengths?.[0];

                                return (
                                    <button
                                        key={audit.id}
                                        onClick={() => handleOpenCreative(audit.creative_id)}
                                        className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-ch-orange/40 hover:bg-muted/40 transition-all group"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted border border-border flex-shrink-0">
                                                {thumb ? (
                                                    <img
                                                        src={getProxiedImageUrl(thumb, audit.creatives?.external_id || null) || thumb}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <FileImage className="w-5 h-5 text-muted-foreground/40" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <div className="min-w-0 flex-1">
                                                        {!creativeId && (
                                                            <h4 className="text-sm font-bold text-foreground truncate group-hover:text-ch-orange transition-colors">
                                                                {audit.creatives?.name || 'Criativo removido'}
                                                            </h4>
                                                        )}
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            {auditTypeLabel} · {date}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className={`text-lg font-semibold tabular-nums ${scoreColor}`}>{score}%</span>
                                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-ch-orange group-hover:translate-x-0.5 transition-all" />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    <StatusBadge status={audit.status} />
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

                                                {(previewStrength || previewWeakness) && (
                                                    <div className="space-y-1 mt-2">
                                                        {previewStrength && (
                                                            <p className="text-xs text-emerald-500/90 flex items-start gap-1.5">
                                                                <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                                <span className="line-clamp-1">{previewStrength}</span>
                                                            </p>
                                                        )}
                                                        {previewWeakness && (
                                                            <p className="text-xs text-rose-500/90 flex items-start gap-1.5">
                                                                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                                <span className="line-clamp-1">{previewWeakness}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-4 border-t border-border bg-muted/20">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="w-full rounded-xl font-bold text-[10px] uppercase tracking-widest"
                    >
                        Fechar
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
