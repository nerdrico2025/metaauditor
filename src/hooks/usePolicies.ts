import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Policy {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    scope: string | null;
    campaign_ids: string[] | null;
    brand_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
    brand_guidelines: string | null;
    required_keywords: string[] | null;
    prohibited_keywords: string[] | null;
    required_phrases: string[] | null;
    prohibited_phrases: string[] | null;
    min_text_length: number | null;
    max_text_length: number | null;
    requires_logo: boolean | null;
    requires_brand_colors: boolean | null;
    ctr_min: number | null;
    ctr_target: number | null;
    cpc_max: number | null;
    cpc_target: number | null;
    conversions_min: number | null;
    conversions_target: number | null;
    status: string | null;
    is_default: boolean | null;
    created_at: string;
    updated_at: string;
}

export interface CreatePolicyInput {
    name: string;
    description?: string;
    scope?: 'global' | 'campaign';
    campaign_ids?: string[];
    brand_name?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    brand_guidelines?: string;
    required_keywords?: string[];
    prohibited_keywords?: string[];
    required_phrases?: string[];
    prohibited_phrases?: string[];
    min_text_length?: number;
    max_text_length?: number;
    requires_logo?: boolean;
    requires_brand_colors?: boolean;
    ctr_min?: number;
    ctr_target?: number;
    cpc_max?: number;
    cpc_target?: number;
    conversions_min?: number;
    conversions_target?: number;
    status?: 'active' | 'draft' | 'archived';
    is_default?: boolean;
}

export interface UpdatePolicyInput extends Partial<CreatePolicyInput> {
    id: string;
}

export function usePolicies() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company?.id;

    const policiesQuery = useQuery({
        queryKey: ['policies', companyId],
        queryFn: async () => {
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('policies')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Policy[];
        },
        enabled: !!companyId,
    });

    const createPolicy = useMutation({
        mutationFn: async (input: CreatePolicyInput) => {
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('policies')
                .insert({
                    ...input,
                    company_id: companyId,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['policies', companyId] });
            toast.success('Política criada com sucesso');
        },
        onError: (error) => {
            toast.error(`Erro ao criar política: ${error.message}`);
        },
    });

    const updatePolicy = useMutation({
        mutationFn: async ({ id, ...input }: UpdatePolicyInput) => {
            const { data, error } = await supabase
                .from('policies')
                .update({ ...input, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['policies', companyId] });
            toast.success('Política atualizada com sucesso');
        },
        onError: (error) => {
            toast.error(`Erro ao atualizar política: ${error.message}`);
        },
    });

    const deletePolicy = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('policies')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['policies', companyId] });
            toast.success('Política excluída com sucesso');
        },
        onError: (error) => {
            toast.error(`Erro ao excluir política: ${error.message}`);
        },
    });

    return {
        policies: policiesQuery.data || [],
        isLoading: policiesQuery.isLoading,
        error: policiesQuery.error,
        createPolicy,
        updatePolicy,
        deletePolicy,
    };
}
