import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CampaignActionPayload {
    campaign_id: string;
    action: 'pause' | 'activate' | 'update_budget';
    payload?: {
        daily_budget?: number; // in cents for Meta API
    };
}

export function useCampaignAction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaign_id, action, payload }: CampaignActionPayload) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada');

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-campaign-action`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ campaign_id, action, payload }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Falha ao executar ação na campanha');
            }

            return response.json();
        },
        onSuccess: (_data, variables) => {
            const actionLabels: Record<string, string> = {
                pause: 'Campanha pausada com sucesso',
                activate: 'Campanha ativada com sucesso',
                update_budget: 'Verba atualizada com sucesso',
            };
            toast.success(actionLabels[variables.action] || 'Ação realizada');

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['company-metrics'] });
            queryClient.invalidateQueries({ queryKey: ['audits'] });
        },
        onError: (error: Error) => {
            toast.error(`Erro: ${error.message}`);
        },
    });
}
