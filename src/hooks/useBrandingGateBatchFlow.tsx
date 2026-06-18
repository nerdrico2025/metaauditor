import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BrandingBatchGateDialog } from '@/components/audits/BrandingBatchGateDialog';
import {
    BRANDING_GATE_BATCH_NONE_MSG,
    decideBrandingGate,
    partitionCreativesForPerformanceGate,
    type BrandingGateCreativeItem,
} from '@/lib/brandingPerformanceGate';
import { fetchBrandingGateStatuses, fetchCreativeNamesByIds } from '@/lib/fetchBrandingGateStatuses';

interface PendingGateProceed {
    approvedIds: string[];
    onProceed: (approvedIds: string[]) => void | Promise<void>;
}

export function useBrandingGateBatchFlow() {
    const { user } = useAuth();
    const companyId = user?.company?.id ?? user?.company_id;
    const [gateOpen, setGateOpen] = useState(false);
    const [approvedItems, setApprovedItems] = useState<BrandingGateCreativeItem[]>([]);
    const [blockedItems, setBlockedItems] = useState<BrandingGateCreativeItem[]>([]);
    const [pendingProceed, setPendingProceed] = useState<PendingGateProceed | null>(null);
    const [isResolving, setIsResolving] = useState(false);

    const runWithBrandingGate = useCallback(
        async (
            creativeIds: string[],
            onProceed: (approvedIds: string[]) => void | Promise<void>,
            nameById?: Map<string, string>,
        ) => {
            if (!companyId) return;
            const uniqueIds = [...new Set(creativeIds.filter(Boolean))];
            if (!uniqueIds.length) {
                toast.message('Nenhum criativo selecionado para análise.');
                return;
            }

            setIsResolving(true);
            try {
                const resolvedNames =
                    nameById ??
                    (await fetchCreativeNamesByIds(supabase, companyId, uniqueIds));
                const statusMap = await fetchBrandingGateStatuses(supabase, companyId, uniqueIds);
                const partition = partitionCreativesForPerformanceGate(
                    uniqueIds,
                    statusMap,
                    resolvedNames,
                );
                const decision = decideBrandingGate(partition);

                if (decision.action === 'proceed') {
                    await onProceed(decision.approvedIds);
                    return;
                }
                if (decision.action === 'block') {
                    toast.error(BRANDING_GATE_BATCH_NONE_MSG);
                    return;
                }

                setApprovedItems(partition.approved);
                setBlockedItems(partition.blocked);
                setPendingProceed({ approvedIds: partition.approvedIds, onProceed });
                setGateOpen(true);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Erro ao verificar conformidade de Branding.';
                toast.error(msg);
            } finally {
                setIsResolving(false);
            }
        },
        [companyId],
    );

    const handleGateConfirm = useCallback(
        async (approvedIds: string[]) => {
            const pending = pendingProceed;
            setGateOpen(false);
            setPendingProceed(null);
            if (!pending) return;
            try {
                await pending.onProceed(approvedIds);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Erro ao iniciar análise em lote.';
                toast.error(msg);
            }
        },
        [pendingProceed],
    );

    const handleGateCancel = useCallback(() => {
        setGateOpen(false);
        setPendingProceed(null);
    }, []);

    const BrandingGateDialog = (
        <BrandingBatchGateDialog
            open={gateOpen}
            onOpenChange={(open) => {
                if (!open) handleGateCancel();
                else setGateOpen(true);
            }}
            approved={approvedItems}
            blocked={blockedItems}
            onConfirm={handleGateConfirm}
            onCancel={handleGateCancel}
            isLoading={isResolving}
        />
    );

    return {
        runWithBrandingGate,
        BrandingGateDialog,
        isResolvingBrandingGate: isResolving,
    };
}
