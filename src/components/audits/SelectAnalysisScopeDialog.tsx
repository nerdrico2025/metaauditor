import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export type PerformanceAnalysisScope = 'entities' | 'creatives' | 'both';

interface SelectAnalysisScopeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entityLabel: string;
    entityCount: number;
    creativeEstimate?: number;
    onConfirm: (scope: PerformanceAnalysisScope) => void;
    isLoading?: boolean;
}

export function SelectAnalysisScopeDialog({
    open,
    onOpenChange,
    entityLabel,
    entityCount,
    creativeEstimate,
    onConfirm,
    isLoading,
}: SelectAnalysisScopeDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Analisar em lote</DialogTitle>
                    <DialogDescription>
                        Escolha o escopo da análise de performance para {entityCount} {entityLabel}
                        {entityCount !== 1 ? 's' : ''}.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-2 py-2">
                    <Button
                        variant="outline"
                        className="h-auto py-3 justify-start text-left"
                        disabled={isLoading}
                        onClick={() => onConfirm('entities')}
                    >
                        <div>
                            <p className="font-semibold text-sm">Analisar {entityLabel}s</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {entityCount} diagnóstico(s) com regras agregadas e IA estratégica
                            </p>
                        </div>
                    </Button>
                    <Button
                        variant="outline"
                        className="h-auto py-3 justify-start text-left"
                        disabled={isLoading}
                        onClick={() => onConfirm('creatives')}
                    >
                        <div>
                            <p className="font-semibold text-sm">Analisar criativos ativos</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {creativeEstimate != null
                                    ? `~${creativeEstimate} criativo(s) filho(s) com audit-creative (performance)`
                                    : 'Auditoria performance nos criativos filhos'}
                            </p>
                        </div>
                    </Button>
                    <Button
                        variant="default"
                        className="h-auto py-3 justify-start text-left"
                        disabled={isLoading}
                        onClick={() => onConfirm('both')}
                    >
                        <div>
                            <p className="font-semibold text-sm">Ambos (entidades + criativos)</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Primeiro {entityLabel}s, depois criativos — pode consumir mais créditos de IA
                            </p>
                        </div>
                    </Button>
                </div>

                {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando análise em lote…
                    </div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancelar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
