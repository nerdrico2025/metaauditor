import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    decideBrandingGate,
    partitionCreativesForPerformanceGate,
    type BrandingGatePartition,
} from '@/lib/brandingPerformanceGate';
import { fetchBrandingGateStatuses, fetchCreativeNamesByIds } from '@/lib/fetchBrandingGateStatuses';

export function useBrandingPerformanceGate(creativeIds: string[], enabled = true) {
    const { user } = useAuth();
    const companyId = user?.company?.id ?? user?.company_id;
    const uniqueIds = useMemo(
        () => [...new Set(creativeIds.filter(Boolean))],
        [creativeIds],
    );

    return useQuery({
        queryKey: ['branding-performance-gate', companyId, uniqueIds],
        queryFn: async (): Promise<BrandingGatePartition> => {
            if (!companyId || !uniqueIds.length) {
                return { approvedIds: [], approved: [], blocked: [] };
            }
            const [statusMap, nameById] = await Promise.all([
                fetchBrandingGateStatuses(supabase, companyId, uniqueIds),
                fetchCreativeNamesByIds(supabase, companyId, uniqueIds),
            ]);
            return partitionCreativesForPerformanceGate(uniqueIds, statusMap, nameById);
        },
        enabled: enabled && !!companyId && uniqueIds.length > 0,
        staleTime: 60 * 1000,
    });
}

export { decideBrandingGate };
