import { useMemo } from 'react';
import { useQuery as usePostgrestQuery } from '@supabase-cache-helpers/postgrest-react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Campaign list for Anúncios filter — pilot for @supabase-cache-helpers/postgrest-react-query.
 */
export function useAnunciosCampaigns(companyId: string | undefined, effectiveIds: string[]) {
  const query = useMemo(() => {
    let q = supabase
      .from('campaigns')
      .select('id, name')
      .eq('company_id', companyId ?? '')
      .order('name');
    if (effectiveIds.length > 0) {
      q = q.in('integration_id', effectiveIds);
    }
    return q;
  }, [companyId, effectiveIds]);

  const { data, isLoading, error } = usePostgrestQuery(query, {
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    campaigns: data ?? [],
    isLoading,
    error,
  };
}
