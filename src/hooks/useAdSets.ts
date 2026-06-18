import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useActiveAdSetsCount() {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['active-adsets-count', companyId],
        queryFn: async (): Promise<number> => {
            if (!companyId) throw new Error('No company ID');

            const { data: activeCampaigns } = await supabase
                .from('campaigns')
                .select('id, integration_id')
                .eq('company_id', companyId)
                .not('integration_id', 'is', null);

            const validCampaignIds = activeCampaigns?.map(c => c.id) || [];
            if (validCampaignIds.length === 0) return 0;

            const { count, error } = await supabase
                .from('ad_sets')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .eq('status', 'active')
                .in('campaign_id', validCampaignIds);

            if (error) throw error;
            return count || 0;
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
    });
}
