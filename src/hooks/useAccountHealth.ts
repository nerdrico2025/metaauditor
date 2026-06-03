import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AccountHealth {
    activeCampaigns: number;
    maxCampaigns: number;
    activeIntegrations: number;
    maxIntegrations: number;
    lastSyncAt: string | null;
    integrationStatus: 'connected' | 'expired' | 'error' | 'not_connected';
    alerts: Array<{
        type: 'warning' | 'error' | 'info';
        message: string;
    }>;
}

export function useAccountHealth() {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['account-health', companyId],
        queryFn: async (): Promise<AccountHealth> => {
            if (!companyId) throw new Error('No company ID');

            // Get company limits
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('max_campaigns, max_integrations')
                .eq('id', companyId)
                .single();

            if (companyError) throw companyError;

            // Get active campaigns count
            const { count: activeCampaigns } = await supabase
                .from('campaigns')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .eq('status', 'active');

            // Get integrations
            const { data: integrations } = await supabase
                .from('integrations')
                .select('status, last_sync_at, token_expires_at')
                .eq('company_id', companyId)
                .eq('platform', 'meta');

            const activeIntegrations = integrations?.filter(i => i.status === 'active').length || 0;
            const latestSync = integrations?.map(i => i.last_sync_at).filter(Boolean).sort().reverse()[0] || null;

            // Determine integration status
            let integrationStatus: AccountHealth['integrationStatus'] = 'not_connected';
            if (integrations && integrations.length > 0) {
                const hasExpired = integrations.some(i =>
                    i.token_expires_at && new Date(i.token_expires_at) < new Date()
                );
                const hasError = integrations.some(i => i.status === 'error');

                if (hasExpired) {
                    integrationStatus = 'expired';
                } else if (hasError) {
                    integrationStatus = 'error';
                } else if (activeIntegrations > 0) {
                    integrationStatus = 'connected';
                }
            }

            // Generate alerts
            const alerts: AccountHealth['alerts'] = [];

            if (integrationStatus === 'expired') {
                alerts.push({ type: 'warning', message: 'Token do Meta expirado. Reconecte sua conta.' });
            }

            if (integrationStatus === 'not_connected') {
                alerts.push({ type: 'info', message: 'Conecte sua conta do Meta para começar.' });
            }

            return {
                activeCampaigns: activeCampaigns || 0,
                maxCampaigns: company?.max_campaigns || 10,
                activeIntegrations,
                maxIntegrations: company?.max_integrations ?? 15,
                lastSyncAt: latestSync,
                integrationStatus,
                alerts,
            };
        },
        enabled: !!companyId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useSyncStatus() {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['sync-status', companyId],
        queryFn: async () => {
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('sync_history')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            return data || [];
        },
        enabled: !!companyId,
        staleTime: 1 * 60 * 1000,
    });
}
