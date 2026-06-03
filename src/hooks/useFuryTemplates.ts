import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FuryTemplate {
    id: string;
    name: string;
    description: string | null;
    category: string;
    trigger_conditions: any;
    action_type: string;
    applies_to: string;
    icon: string | null;
    severity: string;
    installed: boolean;
    rule_id: string | null;
    rule_status: string | null;
}

export function useFuryTemplates() {
    const queryClient = useQueryClient();

    const templatesQuery = useQuery({
        queryKey: ['fury-templates'],
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Sessao expirada');

            const { data, error } = await supabase.functions.invoke('fury-install-template', {
                body: { action: 'list' },
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (error) throw error;
            return (data?.templates || []) as FuryTemplate[];
        },
    });

    const installMutation = useMutation({
        mutationFn: async ({ templateId, overrides }: { templateId: string; overrides?: { threshold?: number } }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Sessao expirada');

            const { data, error } = await supabase.functions.invoke('fury-install-template', {
                body: { template_id: templateId, overrides },
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Erro ao instalar');
            return data;
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['fury-templates'] });
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            toast.success('Regra ativada');
        },
        onError: (err: any) => {
            if (err.message?.includes('already installed')) {
                toast.info('Regra ja esta ativa');
            } else {
                toast.error(err.message || 'Erro ao ativar regra');
            }
        },
    });

    const uninstallMutation = useMutation({
        mutationFn: async (templateId: string) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Sessao expirada');

            const { data, error } = await supabase.functions.invoke('fury-install-template', {
                body: { action: 'uninstall', template_id: templateId },
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fury-templates'] });
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            toast.success('Regra desativada');
        },
        onError: (err: any) => {
            toast.error(err.message || 'Erro ao desativar');
        },
    });

    return {
        templates: templatesQuery.data || [],
        isLoading: templatesQuery.isLoading,
        install: installMutation.mutateAsync,
        uninstall: uninstallMutation.mutateAsync,
        isInstalling: installMutation.isPending,
    };
}
