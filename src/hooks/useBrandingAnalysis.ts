import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCreativeRules } from '@/hooks/useCreativeRules';
import {
  useBatchCreativeRuleCheck,
  BatchCheckResultItem,
  BatchCreativeMeta,
  BatchProgress,
} from '@/hooks/useBatchCreativeRuleCheck';
import { isBrandBriefingComplete, type Company } from '@/hooks/useCompany';
import { getScopedCampaignIds } from '@/lib/creativeScope';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { toast } from 'sonner';

export async function fetchActiveCreativesForIntegrations(
  companyId: string,
  integrationIds: string[],
): Promise<BatchCreativeMeta[]> {
  const campaignIds = await getScopedCampaignIds(companyId, integrationIds);
  if (campaignIds.length === 0) return [];

  return fetchAllPaginated<BatchCreativeMeta>(() =>
    supabase
      .from('creatives')
      .select('id, name, image_url, external_id')
      .eq('company_id', companyId)
      .in('campaign_id', campaignIds)
      .ilike('status', 'active')
      .order('name'),
  );
}

export function useBrandingAnalysis() {
  const { user } = useAuth();
  const companyId = user?.company?.id;
  const { rules } = useCreativeRules();
  const { runPagedBatch, isRunning, progress } = useBatchCreativeRuleCheck();

  const activeRules = rules?.filter(r => r.is_active) ?? [];

  const runFullAnalysis = useCallback(
    async ({
      ruleIds,
      integrationIds,
      onProgress,
    }: {
      ruleIds: string[];
      integrationIds: string[];
      onProgress?: (p: BatchProgress) => void;
    }): Promise<{ results: BatchCheckResultItem[]; nonCompliant: BatchCheckResultItem[] }> => {
      if (!companyId) {
        toast.error('Empresa não identificada.');
        return { results: [], nonCompliant: [] };
      }

      if (activeRules.length === 0) {
        toast.error('Nenhuma regra de branding ativa. Crie regras em Regras de Branding.', {
          action: { label: 'Ir para Regras', onClick: () => { window.location.href = '/regras'; } },
        });
        return { results: [], nonCompliant: [] };
      }

      let creatives: BatchCreativeMeta[];
      try {
        creatives = await fetchActiveCreativesForIntegrations(companyId, integrationIds);
      } catch (err) {
        console.error('Failed to fetch active creatives:', err);
        toast.error('Erro ao carregar criativos. Tente novamente.');
        throw err;
      }

      if (creatives.length === 0) {
        toast.warning('Nenhum criativo ativo em campanhas ativas encontrado para analisar.');
        return { results: [], nonCompliant: [] };
      }

      toast.info(`Iniciando análise de ${creatives.length} criativo(s) ativos em campanhas ativas...`);

      return runPagedBatch({
        creatives,
        ruleIds: ruleIds.length > 0 ? ruleIds : undefined,
        onProgress,
      });
    },
    [companyId, activeRules.length, runPagedBatch],
  );

  return {
    runFullAnalysis,
    isRunning,
    progress,
    activeRulesCount: activeRules.length,
    isBriefingComplete: (company: Company | undefined) =>
      isBrandBriefingComplete(company?.ai_context?.brand_briefing),
  };
}
