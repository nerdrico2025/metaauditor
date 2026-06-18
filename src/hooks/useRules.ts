import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AutomationRule {
    id: string;
    company_id: string;
    name: string;
    description?: string;
    status: 'active' | 'paused';
    trigger_type: string;
    trigger_conditions: any;
    action_type: string;
    action_config: any;
    last_triggered_at?: string;
    trigger_count: number;
    created_at: string;
    updated_at: string;
}

export type CreateRuleData = Omit<AutomationRule, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'last_triggered_at' | 'trigger_count'>;
export type UpdateRuleData = Partial<CreateRuleData>;

export function useRules() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company?.id;

    // Fetch Rules
    const { data: rules, isLoading, error } = useQuery({
        queryKey: ['automation-rules', companyId],
        queryFn: async () => {
            if (!companyId) throw new Error('Company ID not found');

            const { data, error } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching rules:', error);
                throw error;
            }

            return data as AutomationRule[];
        },
        enabled: !!companyId,
    });

    // Create Rule
    const createRule = useMutation({
        mutationFn: async (newRule: CreateRuleData) => {
            if (!companyId) throw new Error('Company ID not found');

            const { data, error } = await supabase
                .from('automation_rules')
                .insert([{ ...newRule, company_id: companyId }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules', companyId] });
            toast.success('Regra criada com sucesso!');
        },
        onError: (error: any) => {
            console.error('Error creating rule:', error);
            toast.error(`Erro ao criar regra: ${error.message}`);
        },
    });

    // Update Rule
    const updateRule = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateRuleData }) => {
            const { error } = await supabase
                .from('automation_rules')
                .update(data)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules', companyId] });
            toast.success('Regra atualizada com sucesso!');
        },
        onError: (error: any) => {
            console.error('Error updating rule:', error);
            toast.error(`Erro ao atualizar regra: ${error.message}`);
        },
    });

    // Delete Rule
    const deleteRule = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('automation_rules')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules', companyId] });
            toast.success('Regra excluída com sucesso!');
        },
        onError: (error: any) => {
            console.error('Error deleting rule:', error);
            toast.error(`Erro ao excluir regra: ${error.message}`);
        },
    });

    // Toggle Status Specific Mutation for easier usage
    const toggleStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: 'active' | 'paused' }) => {
            const newStatus = status === 'active' ? 'paused' : 'active';
            const { error } = await supabase
                .from('automation_rules')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            return newStatus;
        },
        onSuccess: (newStatus) => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules', companyId] });
            toast.success(`Regra ${newStatus === 'active' ? 'ativada' : 'pausada'}!`);
        },
        onError: (error: any) => {
            toast.error(`Erro ao alterar status: ${error.message}`);
        },
    });

    return {
        rules,
        isLoading,
        error,
        createRule,
        updateRule,
        deleteRule,
        toggleStatus
    };
}
