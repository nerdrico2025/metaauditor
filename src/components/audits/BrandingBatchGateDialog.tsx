import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import type { BrandingGateCreativeItem } from '@/lib/brandingPerformanceGate';
import { brandingGateStatusLabel } from '@/lib/brandingPerformanceGate';
import { cn } from '@/lib/utils';

interface BrandingBatchGateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    approved: BrandingGateCreativeItem[];
    blocked: BrandingGateCreativeItem[];
    onConfirm: (approvedIds: string[]) => void;
    onCancel?: () => void;
    isLoading?: boolean;
}

function GateCreativeList({
    items,
    variant,
}: {
    items: BrandingGateCreativeItem[];
    variant: 'approved' | 'blocked';
}) {
    const isApproved = variant === 'approved';

    return (
        <div
            className={cn(
                'flex flex-col gap-2 rounded-xl border p-3 min-h-[120px] max-h-[240px] overflow-y-auto',
                isApproved ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/20 bg-muted/30',
            )}
        >
            <p
                className={cn(
                    'text-xs font-bold uppercase tracking-wide flex items-center gap-1.5',
                    isApproved ? 'text-emerald-600' : 'text-muted-foreground',
                )}
            >
                {isApproved ? (
                    <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                    <ShieldX className="w-3.5 h-3.5 text-rose-500" />
                )}
                {isApproved ? 'Aprovados em Branding' : 'Não elegíveis'} ({items.length})
            </p>
            {items.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum</p>
            ) : (
                items.map((item) => (
                    <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-2"
                    >
                        <span className="text-sm font-medium truncate">
                            {item.name ?? `Criativo ${item.id.slice(0, 8)}`}
                        </span>
                        {!isApproved && (
                            <Badge
                                variant="outline"
                                className={cn(
                                    'text-[10px] shrink-0',
                                    item.status === 'warning' && 'border-amber-500/40 text-amber-600',
                                    item.status === 'rejected' && 'border-rose-500/40 text-rose-600',
                                    item.status === 'none' && 'text-muted-foreground',
                                )}
                            >
                                {brandingGateStatusLabel(item.status)}
                            </Badge>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}

export function BrandingBatchGateDialog({
    open,
    onOpenChange,
    approved,
    blocked,
    onConfirm,
    onCancel,
    isLoading,
}: BrandingBatchGateDialogProps) {
    const handleCancel = () => {
        onCancel?.();
        onOpenChange(false);
    };

    const handleConfirm = () => {
        onConfirm(approved.map((a) => a.id));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Conformidade de Branding</DialogTitle>
                    <DialogDescription>
                        A análise de Performance só pode ser executada em criativos aprovados em Branding.
                        {blocked.length > 0 && approved.length > 0 && (
                            <> {blocked.length} criativo(s) serão ignorados.</>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
                    <GateCreativeList items={approved} variant="approved" />
                    <GateCreativeList items={blocked} variant="blocked" />
                </div>

                {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparando análise…
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={handleCancel} disabled={isLoading}>
                        Cancelar
                    </Button>
                    {approved.length > 0 && (
                        <Button onClick={handleConfirm} disabled={isLoading}>
                            Continuar com {approved.length} aprovado{approved.length !== 1 ? 's' : ''}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
