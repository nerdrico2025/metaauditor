import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tag } from './useTags';

export interface Creative {
    id: string;
    external_id: string;
    name: string;
    type: string;
    creative_format: string;
    platform: string;
    status: string;
    headline: string | null;
    description: string | null;
    image_url: string | null;
    video_url: string | null;
    call_to_action: string | null;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    performance_score: number;
    created_at: string;
    campaigns?: { name: string };
    tags?: { tag: Tag }[];
}

export interface CreativeFilters {
    type?: string;
    search?: string;
    limit?: number;
    offset?: number;
}

export function useTopCreatives(limit: number = 5) {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['top-creatives', companyId, limit],
        queryFn: async (): Promise<Creative[]> => {
            if (!companyId) throw new Error('No company ID');

            const { data, error } = await supabase
                .from('creatives')
                .select('*, campaigns(name), creative_tags(tag:tags(*))')
                .eq('company_id', companyId)
                .order('performance_score', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error in useTopCreatives:', error);
                throw error;
            }
            return (data as any)?.map((c: any) => ({ ...c, tags: c.creative_tags })) || [];
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreatives(filters: CreativeFilters = {}) {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['creatives', companyId, filters],
        queryFn: async (): Promise<{ creatives: Creative[]; total: number }> => {
            if (!companyId) throw new Error('No company ID');

            let query = supabase
                .from('creatives')
                .select('*, campaigns(name), creative_tags(tag:tags(*))', { count: 'exact' });

            query = query.eq('company_id', companyId);

            if (filters.search) {
                query = query.ilike('name', `%${filters.search}%`);
            }

            if (filters.type && filters.type !== 'all') {
                query = query.eq('type', filters.type);
            }

            if (filters.limit) {
                const start = filters.offset || 0;
                const end = start + filters.limit - 1;
                query = query.range(start, end);
            }

            const { data, error, count } = await query;
            if (error) {
                console.error('Error in useCreatives:', error);
                throw error;
            }

            return {
                creatives: (data as any)?.map((c: any) => ({ ...c, tags: c.creative_tags })) || [],
                total: count || 0,
            };
        },
        enabled: !!companyId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useCreativesCount() {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['creatives-count', companyId],
        queryFn: async (): Promise<number> => {
            if (!companyId) throw new Error('No company ID');

            const { count, error } = await supabase
                .from('creatives')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId);

            if (error) throw error;
            return count || 0;
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
    });
}
