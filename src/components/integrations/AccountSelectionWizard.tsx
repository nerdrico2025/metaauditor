import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    Check,
    Loader2,
    Facebook,
    TrendingUp,
    MessageSquare,
    Send,
    ChevronRight,
    Zap,
    Building2,
    ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PendingAccount {
    id: string;
    account_id: string;
    account_name: string;
    currency: string;
    account_status: number;
    amount_spent: number;
    account_type: 'ads_account' | 'whatsapp_clicks' | 'disparo' | 'other';
    session_metadata?: {
        business_manager_id?: string | null;
        business_manager_name?: string | null;
    };
}

interface AccountSelectionWizardProps {
    sessionId: string;
    onComplete: () => void;
    onCancel: () => void;
}

const CURRENCY_SYMBOL: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€', GBP: '£' };
const formatSpend = (amount: number, currency: string) => {
    const symbol = CURRENCY_SYMBOL[currency] || currency;
    if (amount >= 1000) return `${symbol}${(amount / 1000).toFixed(1)}k`;
    return `${symbol}${amount.toFixed(0)}`;
};

export function AccountSelectionWizard({ sessionId, onComplete, onCancel }: AccountSelectionWizardProps) {
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<PendingAccount[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedBMs, setExpandedBMs] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);

    const adsAccounts = accounts.filter(a => a.account_type === 'ads_account' || a.account_type === 'other');
    const nonAdsAccounts = accounts.filter(a => a.account_type === 'whatsapp_clicks' || a.account_type === 'disparo');

    // Agrupa contas de anúncio por BM
    const bmList = useMemo(() => {
        const groups: Record<string, { id: string; name: string; accounts: PendingAccount[] }> = {};

        adsAccounts.forEach(account => {
            const bmId = account.session_metadata?.business_manager_id || 'unassigned';
            const bmName = account.session_metadata?.business_manager_name || 'Contas Pessoais';

            if (!groups[bmId]) {
                groups[bmId] = { id: bmId, name: bmName, accounts: [] };
            }
            groups[bmId].accounts.push(account);
        });

        return Object.values(groups).sort((a, b) => {
            if (a.id === 'unassigned') return 1;
            if (b.id === 'unassigned') return -1;
            return a.name.localeCompare(b.name);
        });
    }, [adsAccounts]);

    const loadPendingAccounts = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke('meta-get-pending-accounts', {
            body: { session_id: sessionId }
        });

        if (error || !data?.accounts?.length) {
            toast({ title: "Sessão expirada", description: "Faça o login com o Facebook novamente.", variant: "destructive" });
            onCancel();
            return;
        }

        const fetchedAccounts: PendingAccount[] = data.accounts;
        setAccounts(fetchedAccounts);

        // BMs começam COLAPSADAS — o usuário clica para expandir
        setExpandedBMs(new Set());

        // Pré-seleciona contas com gasto histórico
        const preSelected = new Set(
            fetchedAccounts
                .filter(a => (a.account_type === 'ads_account' || a.account_type === 'other') && a.amount_spent > 0)
                .map(a => a.account_id)
        );
        if (preSelected.size === 0) {
            fetchedAccounts.filter(a => a.account_type === 'ads_account').forEach(a => preSelected.add(a.account_id));
        }
        setSelectedIds(preSelected);
        setLoading(false);
    }, [sessionId, onCancel, toast]);

    useEffect(() => { loadPendingAccounts(); }, [loadPendingAccounts]);

    const toggleAccount = (accountId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(accountId) ? next.delete(accountId) : next.add(accountId);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === adsAccounts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(adsAccounts.map(a => a.account_id)));
        }
    };

    const toggleBM = (bmId: string) => {
        setExpandedBMs(prev => {
            const next = new Set(prev);
            next.has(bmId) ? next.delete(bmId) : next.add(bmId);
            return next;
        });
    };

    const toggleBMSelection = (bmId: string, bmAccounts: PendingAccount[], e: React.MouseEvent) => {
        e.stopPropagation();
        const accountIds = bmAccounts.map(a => a.account_id);
        const allSelected = accountIds.every(id => selectedIds.has(id));

        setSelectedIds(prev => {
            const next = new Set(prev);
            accountIds.forEach(id => {
                allSelected ? next.delete(id) : next.add(id);
            });
            return next;
        });
    };

    const handleConfirm = async () => {
        if (selectedIds.size === 0) {
            toast({ title: "Selecione ao menos uma conta", description: "Escolha a conta que deseja monitorar.", variant: "destructive" });
            return;
        }

        setConfirming(true);
        const { data, error } = await supabase.functions.invoke('meta-confirm-accounts', {
            body: {
                session_id: sessionId,
                selected_account_ids: Array.from(selectedIds)
            }
        });

        if (error || !data?.success) {
            toast({ title: "Erro ao salvar seleção", description: "Tente novamente.", variant: "destructive" });
            setConfirming(false);
            return;
        }

        toast({
            title: `✅ ${data.monitored_count} conta${data.monitored_count !== 1 ? 's' : ''} configurada${data.monitored_count !== 1 ? 's' : ''}!`,
            description: "As contas selecionadas já estão prontas para sincronização."
        });
        onComplete();
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="w-8 h-8 text-ch-blue animate-spin" />
                <p className="text-muted-foreground font-medium">Carregando contas disponíveis...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                        <Facebook className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-foreground uppercase tracking-tighter">
                            Selecione as Contas para Monitorar
                        </h2>
                        <p className="text-sm text-muted-foreground font-medium mt-1">
                            {bmList.length} Business Manager{bmList.length !== 1 ? 's' : ''} · {adsAccounts.length} conta{adsAccounts.length !== 1 ? 's' : ''} de anúncio
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                    className="shrink-0 text-xs font-bold border border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                >
                    {selectedIds.size === adsAccounts.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </Button>
            </div>

            {/* Business Managers (accordion) */}
            <div className="space-y-3">
                {bmList.map((bm, bmIdx) => {
                    const isExpanded = expandedBMs.has(bm.id);
                    const selectedInBm = bm.accounts.filter(a => selectedIds.has(a.account_id)).length;
                    const allBmSelected = selectedInBm === bm.accounts.length && bm.accounts.length > 0;
                    const someBmSelected = selectedInBm > 0 && !allBmSelected;
                    const totalSpend = bm.accounts.reduce((sum, a) => sum + a.amount_spent, 0);

                    return (
                        <motion.div
                            key={bm.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: bmIdx * 0.06 }}
                            className={`rounded-xl border overflow-hidden transition-all ${isExpanded
                                    ? 'bg-card border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.06)]'
                                    : 'bg-muted/10 border-border hover:bg-muted/20 hover:border-border'
                                }`}
                        >
                            {/* BM Header */}
                            <div
                                className="flex items-center gap-4 p-4 cursor-pointer select-none"
                                onClick={() => toggleBM(bm.id)}
                            >
                                {/* Checkbox BM */}
                                <div
                                    onClick={(e) => toggleBMSelection(bm.id, bm.accounts, e)}
                                    className={`
                                        w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer
                                        ${allBmSelected ? 'bg-blue-500 border-blue-500' :
                                            someBmSelected ? 'bg-blue-500/40 border-blue-500/60' :
                                                'border-muted-foreground/30 bg-transparent hover:border-blue-500/50'
                                        }
                                    `}
                                >
                                    {allBmSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                    {someBmSelected && <div className="w-2.5 h-0.5 bg-white rounded-full" />}
                                </div>

                                {/* BM Icon */}
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                                    <Building2 className="w-5 h-5 text-blue-500" />
                                </div>

                                {/* BM Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-base text-foreground truncate uppercase tracking-tight">
                                        {bm.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        {bm.accounts.length} conta{bm.accounts.length !== 1 ? 's' : ''} de anúncio
                                        {totalSpend > 0 && <span className="text-emerald-500 ml-2 font-semibold">· {formatSpend(totalSpend, bm.accounts[0]?.currency || 'BRL')} investidos</span>}
                                    </p>
                                </div>

                                {/* Selection badge + chevron */}
                                <div className="flex items-center gap-3 shrink-0">
                                    {selectedInBm > 0 && (
                                        <span className="text-xs font-semibold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                                            {selectedInBm}/{bm.accounts.length}
                                        </span>
                                    )}
                                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </div>

                            {/* Account list (expandable) */}
                            <AnimatePresence initial={false}>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: "easeInOut" }}
                                    >
                                        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-border/50">
                                            {bm.accounts.map((account) => {
                                                const selected = selectedIds.has(account.account_id);
                                                const hasActivity = account.amount_spent > 0;

                                                return (
                                                    <div
                                                        key={account.account_id}
                                                        onClick={() => toggleAccount(account.account_id)}
                                                        className={`
                                                            w-full flex items-center gap-4 p-3.5 rounded-xl border transition-all text-left cursor-pointer
                                                            ${selected
                                                                ? 'bg-blue-500/5 border-blue-500/20 shadow-sm'
                                                                : 'bg-background/50 border-transparent hover:bg-muted/30 hover:border-border'
                                                            }
                                                        `}
                                                    >
                                                        {/* Checkbox */}
                                                        <div className={`
                                                            w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                                                            ${selected ? 'bg-blue-500 border-blue-500' : 'border-muted-foreground/30 bg-transparent'}
                                                        `}>
                                                            {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                                        </div>

                                                        {/* Icon */}
                                                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center transition-all ${selected ? 'bg-blue-500/15' : 'bg-muted/40'
                                                            }`}>
                                                            <Facebook className={`w-4 h-4 ${selected ? 'text-blue-400' : 'text-muted-foreground/60'}`} />
                                                        </div>

                                                        {/* Name & ID */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-base font-bold truncate transition-colors ${selected ? 'text-foreground' : 'text-muted-foreground'
                                                                }`}>
                                                                {account.account_name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground/50 font-mono mt-0.5">
                                                                act_{account.account_id} · {account.currency}
                                                            </p>
                                                        </div>

                                                        {/* Spend badge */}
                                                        <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-widest ${hasActivity
                                                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                                                                : 'bg-muted/30 border border-border text-muted-foreground/40'
                                                            }`}>
                                                            {hasActivity && <TrendingUp className="w-3 h-3" />}
                                                            {hasActivity ? formatSpend(account.amount_spent, account.currency) : 'Sem dados'}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            {/* Contas não selecionáveis (WhatsApp/Disparo) */}
            {nonAdsAccounts.length > 0 && (
                <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-muted/50" />
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-2">
                            Contas de mensagens (excluídas automaticamente)
                        </p>
                        <div className="h-px flex-1 bg-muted/50" />
                    </div>
                    {nonAdsAccounts.map(account => (
                        <div
                            key={account.account_id}
                            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/5 opacity-40 cursor-not-allowed"
                        >
                            <div className="w-5 h-5 rounded-md border border-border bg-transparent shrink-0" />
                            <div className={`p-2 rounded-xl shrink-0 ${account.account_type === 'whatsapp_clicks' ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
                                {account.account_type === 'whatsapp_clicks'
                                    ? <MessageSquare className="w-4 h-4 text-emerald-400" />
                                    : <Send className="w-4 h-4 text-blue-400" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-base font-bold text-muted-foreground truncate">{account.account_name}</p>
                                <p className="text-sm text-muted-foreground/50 font-mono mt-0.5">
                                    {account.account_type === 'whatsapp_clicks' ? 'WhatsApp Business' : 'Conta de Disparo'} — sem campanhas de mídia
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer CTA */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span><strong className="text-foreground">{selectedIds.size}</strong> conta{selectedIds.size !== 1 ? 's' : ''} selecionada{selectedIds.size !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        disabled={confirming}
                        className="border border-border hover:bg-muted/50 text-muted-foreground"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={confirming || selectedIds.size === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold uppercase tracking-wider gap-2 h-10 px-6"
                    >
                        {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                        {confirming ? 'Salvando...' : 'Confirmar Seleção'}
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
