import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Usando tipos do Supabase schema diretamente
export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_active: boolean;
    avatar_url: string | null;
    created_at: string;
    last_login_at: string | null;
}

export interface UpdateUserInput {
    first_name?: string;
    last_name?: string;
    role?: 'super_admin' | 'company_admin' | 'operador';
    is_active?: boolean;
}

export function useCompanyUsers() {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['company-users', companyId],
        queryFn: async (): Promise<User[]> => {
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('users')
                .select('id, email, first_name, last_name, role, is_active, avatar_url, created_at, last_login_at')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []) as User[];
        },
        enabled: !!companyId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useUpdateUser() {
    const { user } = useAuth();
    const companyId = user?.company?.id;
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ userId, updates }: { userId: string; updates: UpdateUserInput }) => {
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('users')
                .update(updates as Record<string, unknown>)
                .eq('id', userId)
                .eq('company_id', companyId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['company-users'] });
            toast({
                title: 'Usuário atualizado',
                description: 'As alterações foram salvas.',
            });
        },
        onError: (error) => {
            toast({
                title: 'Erro ao atualizar',
                description: String(error),
                variant: 'destructive',
            });
        },
    });
}

export function useRemoveUser() {
    const { user } = useAuth();
    const companyId = user?.company?.id;
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (userId: string) => {
            if (!companyId) throw new Error('No company ID');

            // Desativar o usuário ao invés de removê-lo
            const { error } = await supabase
                .from('users')
                .update({ is_active: false })
                .eq('id', userId)
                .eq('company_id', companyId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['company-users'] });
            toast({
                title: 'Usuário removido',
                description: 'O usuário foi desativado da empresa.',
            });
        },
        onError: (error) => {
            toast({
                title: 'Erro ao remover',
                description: String(error),
                variant: 'destructive',
            });
        },
    });
}
