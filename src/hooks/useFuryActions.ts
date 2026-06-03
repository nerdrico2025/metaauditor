import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FuryAction {
    id: string;
    company_id: string;
    rule_id: string | null;
    entity_type: 'campaign' | 'adset' | 'ad';
    entity_id: string;
    entity_external_id: string | null;
    entity_name: string | null;
    action_type: string;
    action_config: any;
    trigger_metric: string | null;
    trigger_value: number | null;
    trigger_threshold: number | null;
    trigger_window_days: number | null;
    status: 'executed' | 'undone' | 'failed' | 'pending_approval';
    undone_at: string | null;
    undo_deadline: string | null;
    executed_at: string;
    created_at: string;
}

export interface FuryStats {
    totalToday: number;
    executedToday: number;
    undoneToday: number;
    failedToday: number;
    pendingApproval: number;
}

export function useFuryActions() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company?.id;

    const actionsQuery = useQuery({
        queryKey: ['fury-actions', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fury_actions')
                .select('*')
                .eq('company_id', companyId!)
                .order('executed_at', { ascending: false })
                .limit(100);
            if (error) throw error;
            return (data || []) as FuryAction[];
        },
        enabled: !!companyId,
        refetchInterval: 30000, // poll every 30s for real-time feel
    });

    const statsQuery = useQuery({
        queryKey: ['fury-stats', companyId],
        queryFn: async () => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from('fury_actions')
                .select('status')
                .eq('company_id', companyId!)
                .gte('executed_at', todayStart.toISOString());
            if (error) throw error;

            const actions = data || [];
            return {
                totalToday: actions.length,
                executedToday: actions.filter(a => a.status === 'executed').length,
                undoneToday: actions.filter(a => a.status === 'undone').length,
                failedToday: actions.filter(a => a.status === 'failed').length,
                pendingApproval: actions.filter(a => a.status === 'pending_approval').length,
            } as FuryStats;
        },
        enabled: !!companyId,
        refetchInterval: 30000,
    });

    const undoMutation = useMutation({
        mutationFn: async (actionId: string) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Sessao expirada');

            const { data, error } = await supabase.functions.invoke('fury-undo-action', {
                body: { action_id: actionId },
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || data?.message || 'Erro ao desfazer');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fury-actions'] });
            queryClient.invalidateQueries({ queryKey: ['fury-stats'] });
            toast.success('Acao desfeita com sucesso');
        },
        onError: (err: any) => {
            toast.error(err.message || 'Erro ao desfazer acao');
        },
    });

    return {
        actions: actionsQuery.data || [],
        stats: statsQuery.data || { totalToday: 0, executedToday: 0, undoneToday: 0, failedToday: 0, pendingApproval: 0 },
        isLoading: actionsQuery.isLoading,
        undo: undoMutation.mutateAsync,
        isUndoing: undoMutation.isPending,
    };
}
