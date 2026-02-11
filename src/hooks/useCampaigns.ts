import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tag } from './useTags';

export interface Campaign {
    id: string;
    external_id: string;
    name: string;
    platform: string;
    status: string;
    objective: string | null;
    daily_budget: number | null;
    lifetime_budget: number | null;
    impressions: number;
    clicks: number;
    spend: number;
    created_at: string;
    updated_at: string;
    tags?: { tag: Tag }[];
}

export interface CampaignFilters {
    status?: string;
    platform?: string;
    search?: string;
    limit?: number;
    offset?: number;
}

export function useCampaigns(filters: CampaignFilters = {}) {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['campaigns', companyId, filters],
        queryFn: async (): Promise<{ campaigns: Campaign[]; total: number }> => {
            if (!companyId) throw new Error('No company ID');

            let query = supabase
                .from('campaigns')
                .select('*, campaign_tags(tag:tags(*))', { count: 'exact' })
                .eq('company_id', companyId)
                .order('updated_at', { ascending: false });

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            // Enforce Meta platform
            query = query.eq('platform', 'meta');

            /* 
            if (filters.platform) {
                query = query.eq('platform', filters.platform);
            }
            */

            if (filters.search) {
                query = query.ilike('name', `%${filters.search}%`);
            }

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            if (filters.offset) {
                query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
            }

            const { data, error, count } = await query;

            if (error) throw error;

            return {
                campaigns: (data as any)?.map((c: any) => ({ ...c, tags: c.campaign_tags })) || [],
                total: count || 0,
            };
        },
        enabled: !!companyId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useCampaign(campaignId: string) {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['campaign', campaignId],
        queryFn: async (): Promise<Campaign> => {
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('campaigns')
                .select('*, campaign_tags(tag:tags(*))')
                .eq('id', campaignId)
                .eq('company_id', companyId)
                .single();

            if (error) {
                console.error('Error in useCampaign:', error);
                throw error;
            }
            return {
                ...(data as any),
                tags: (data as any).campaign_tags
            };
        },
        enabled: !!companyId && !!campaignId,
    });
}

export function useActiveCampaignsCount() {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['active-campaigns-count', companyId],
        queryFn: async (): Promise<number> => {
            if (!companyId) throw new Error('No company ID');

            const { count, error } = await supabase
                .from('campaigns')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .eq('platform', 'meta')
                .eq('status', 'active');

            if (error) throw error;
            return count || 0;
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
    });
}
