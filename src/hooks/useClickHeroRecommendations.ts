import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ClickHeroRecommendationStatus = 'open' | 'dismissed' | 'done';

export interface ClickHeroRecommendation {
    id: string;
    company_id: string;
    source_type: 'creative_audit' | 'account_analysis' | 'campaign_analysis';
    creative_id: string | null;
    campaign_id: string | null;
    audit_id: string | null;
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    rationale: string;
    next_step: string;
    status: ClickHeroRecommendationStatus;
    created_at: string;
    creatives?: { name: string } | null;
}

export function useClickHeroRecommendations(
    status: ClickHeroRecommendationStatus | 'all' = 'open',
    options?: { enabled?: boolean },
) {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['click-hero-recommendations', companyId, status],
        enabled: !!companyId && (options?.enabled ?? true),
        queryFn: async () => {
            let q = supabase
                .from('click_hero_recommendations')
                .select('*, creatives(name)')
                .eq('company_id', companyId!)
                .order('created_at', { ascending: false });

            if (status !== 'all') {
                q = q.eq('status', status);
            }

            const { data, error } = await q.limit(100);
            if (error) throw error;
            return (data ?? []) as ClickHeroRecommendation[];
        },
    });
}

export function useClickHeroRecommendationActions() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const companyId = user?.company?.id;

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['click-hero-recommendations', companyId] });
    };

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: ClickHeroRecommendationStatus }) => {
            const { error } = await supabase
                .from('click_hero_recommendations')
                .update({ status })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: (_, { status }) => {
            invalidate();
            toast.success(status === 'done' ? 'Marcada como feita' : 'Recomendação dispensada');
        },
        onError: () => toast.error('Não foi possível atualizar a recomendação'),
    });

    return { updateStatus, invalidate };
}
