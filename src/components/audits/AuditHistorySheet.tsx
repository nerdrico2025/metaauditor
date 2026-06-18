import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';
import { useAudits } from '@/hooks/useAudits';
import { auditFocusLabel, moduleToAuditFocus } from '@/lib/audit-focus';
import { useModule } from '@/contexts/ModuleContext';
import { AuditHistoryList } from '@/components/audits/AuditHistoryList';
import { useCrossFocusStatusMap } from '@/hooks/useCrossFocusStatusMap';

interface AuditHistorySheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    creativeId?: string;
    title?: string;
}

export function AuditHistorySheet({ open, onOpenChange, creativeId, title }: AuditHistorySheetProps) {
    const navigate = useNavigate();
    const { module } = useModule();
    const auditFocus = moduleToAuditFocus(module);
    const { audits, isLoading } = useAudits(auditFocus);

    const entries = useMemo(() => {
        const filtered = creativeId ? audits.filter((a) => a.creative_id === creativeId) : audits;
        return filtered.map((audit) => ({ audit, kind: 'creative' as const }));
    }, [audits, creativeId]);

    const { oppositeFocus: crossFocusOpposite, statusMap: crossFocusByCreativeId } =
        useCrossFocusStatusMap(creativeId ? [creativeId] : [], module);

    const headerTitle = title || (creativeId ? 'Histórico de Auditoria IA' : 'Histórico de Auditoria IA');
    const headerDescription = creativeId
        ? `Diagnósticos de IA deste criativo (${auditFocusLabel(auditFocus)}). Reprovados por regras de branding ficam em Histórico.`
        : `Diagnósticos de IA salvos — foco ${auditFocusLabel(auditFocus).toLowerCase()}. Clique para abrir o criativo.`;

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
                    <AuditHistoryList
                        entries={entries}
                        isLoading={isLoading}
                        showCreativeName={!creativeId}
                        auditFocus={auditFocus}
                        crossFocusOpposite={crossFocusOpposite}
                        crossFocusByCreativeId={crossFocusByCreativeId}
                        onSelect={(entry) => {
                            navigate(`/criativos/${entry.audit.creative_id}`);
                            onOpenChange(false);
                        }}
                        emptyState={
                            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
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
                                        Histórico → Reprovados
                                    </button>
                                    .
                                </p>
                            </div>
                        }
                    />
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
