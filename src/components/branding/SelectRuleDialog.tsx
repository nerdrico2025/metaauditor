import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Zap, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useCreativeRules, CreativeRule } from '@/hooks/useCreativeRules';
import { useRules, AutomationRule } from '@/hooks/useRules';

export type SelectRuleDialogVariant = 'branding' | 'performance';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Called with the selected rule IDs (empty array = "all rules"). */
    onConfirm: (ruleIds: string[]) => void;
    /** Branding = creative_rules; Performance = automation_rules */
    variant?: SelectRuleDialogVariant;
    /** Optional title override. */
    title?: string;
    /** Optional helper text. */
    description?: string;
}

const RULE_TYPE_LABELS: Record<string, string> = {
    content: 'Conteúdo',
    visual: 'Visual',
    copy: 'Copy',
    structure: 'Estrutura',
};

interface RuleListItem {
    id: string;
    name: string;
    description?: string | null;
    badge: string;
}

function formatPerfBadge(rule: AutomationRule): string {
    const metric = rule.trigger_conditions?.metric;
    const op = rule.trigger_conditions?.operator ?? 'lt';
    const threshold = rule.trigger_conditions?.threshold;
    if (metric && threshold != null) {
        return `${String(metric).toUpperCase()} ${op} ${threshold}`;
    }
    return rule.trigger_type || 'Performance';
}

export function SelectRuleDialog({
    isOpen,
    onClose,
    onConfirm,
    variant = 'branding',
    title,
    description,
}: Props) {
    const { rules: creativeRules, isLoading: brandingLoading } = useCreativeRules();
    const { rules: automationRules, isLoading: perfLoading } = useRules();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const isPerformance = variant === 'performance';
    const isLoading = isPerformance ? perfLoading : brandingLoading;

    const activeRules = useMemo((): RuleListItem[] => {
        if (isPerformance) {
            return (automationRules ?? [])
                .filter((r) => r.status === 'active')
                .map((r) => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    badge: formatPerfBadge(r),
                }));
        }
        return (creativeRules ?? [])
            .filter((r: CreativeRule) => r.is_active)
            .map((r) => ({
                id: r.id,
                name: r.name,
                description: r.description,
                badge: RULE_TYPE_LABELS[r.rule_type] || r.rule_type,
            }));
    }, [isPerformance, automationRules, creativeRules]);

    useEffect(() => {
        if (isOpen) setSelectedIds(new Set());
    }, [isOpen]);

    const allChecked = activeRules.length > 0 && selectedIds.size === activeRules.length;
    const noneChecked = selectedIds.size === 0;

    const toggle = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (allChecked) setSelectedIds(new Set());
        else setSelectedIds(new Set(activeRules.map((r) => r.id)));
    };

    const handleConfirm = () => {
        const ids = noneChecked ? [] : Array.from(selectedIds);
        onConfirm(ids);
        onClose();
    };

    const defaultTitle = isPerformance ? 'Quais regras de performance aplicar?' : 'Quais regras aplicar?';
    const defaultDescription = isPerformance
        ? 'Selecione as regras de performance para esta análise. Deixe em branco para aplicar todas as ativas.'
        : 'Selecione apenas as regras que se aplicam a esta análise. Deixe em branco para aplicar todas as ativas.';
    const Icon = isPerformance ? Zap : Shield;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col overflow-hidden p-0">
                <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${isPerformance ? 'text-primary' : 'text-ch-orange'}`} />
                        {title ?? defaultTitle}
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-1">
                        {description ?? defaultDescription}
                    </DialogDescription>
                </div>

                <div className="px-6 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">
                        {activeRules.length} regra{activeRules.length !== 1 ? 's' : ''} ativa{activeRules.length !== 1 ? 's' : ''}
                    </span>
                    <button
                        type="button"
                        onClick={toggleAll}
                        disabled={activeRules.length === 0}
                        className="text-xs font-semibold text-ch-orange hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                        {allChecked ? 'Limpar seleção' : 'Selecionar todas'}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                    {isLoading ? (
                        <div className="py-10 flex justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-ch-orange" />
                        </div>
                    ) : activeRules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <Icon className="w-8 h-8 opacity-30" />
                            <p className="text-sm font-medium">Nenhuma regra ativa disponível</p>
                            <p className="text-xs">Crie e ative regras antes de rodar uma análise.</p>
                        </div>
                    ) : (
                        activeRules.map((rule) => {
                            const isSelected = selectedIds.has(rule.id);
                            return (
                                <button
                                    type="button"
                                    key={rule.id}
                                    onClick={() => toggle(rule.id)}
                                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                        isSelected
                                            ? 'border-ch-orange/40 bg-ch-orange/5'
                                            : 'border-border bg-card hover:border-ch-orange/30'
                                    }`}
                                >
                                    {isSelected ? (
                                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-ch-orange flex-shrink-0" />
                                    ) : (
                                        <Circle className="w-4 h-4 mt-0.5 text-muted-foreground/50 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                            <span className="text-sm font-semibold text-foreground">{rule.name}</span>
                                            <Badge variant="outline" className="text-[10px] font-medium">
                                                {rule.badge}
                                            </Badge>
                                        </div>
                                        {rule.description && (
                                            <p className="text-[11px] text-muted-foreground line-clamp-2">{rule.description}</p>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                        {noneChecked
                            ? <span>Aplicará <strong className="text-foreground">todas</strong> as regras ativas</span>
                            : <span><strong className="text-ch-orange">{selectedIds.size}</strong> regra{selectedIds.size !== 1 ? 's' : ''} selecionada{selectedIds.size !== 1 ? 's' : ''}</span>}
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                        <Button
                            size="sm"
                            onClick={handleConfirm}
                            disabled={activeRules.length === 0}
                            className="bg-ch-orange text-black font-bold"
                        >
                            Analisar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
