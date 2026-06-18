import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CreativeRuleCheck, CreativeRuleCheckResult } from '@/hooks/useCreativeRules';
import { friendlyEdgeFunctionError, parseSupabaseFunctionError } from '@/lib/edgeFunctionErrors';
import { toast } from 'sonner';

export interface BatchCreativeMeta {
  id: string;
  name: string;
  image_url?: string | null;
  external_id?: string | null;
}

export interface BatchCheckResultItem {
  creativeId: string;
  name: string;
  imageUrl: string | null;
  externalId: string | null;
  check: CreativeRuleCheck;
}

export interface BatchProgress {
  current: number;
  total: number;
  creativeName: string;
  batchIndex?: number;
  batchTotal?: number;
}

const BATCH_CHUNK_SIZE = 25;
const BATCH_CONCURRENCY = 4;

function extractFailedRules(results: CreativeRuleCheckResult[]) {
  return results
    .filter(r => !r.passed)
    .map(r => ({ rule_name: r.rule_name, severity: r.severity, reason: r.reason }));
}

async function checkSingleCreative(
  creative: BatchCreativeMeta,
  ruleIds?: string[],
  force = false,
): Promise<BatchCheckResultItem> {
  const body: { creative_id: string; rule_ids?: string[]; force?: boolean } = {
    creative_id: creative.id,
    force,
  };
  if (ruleIds && ruleIds.length > 0) body.rule_ids = ruleIds;

  const response = await supabase.functions.invoke('check-creative-rules', { body });

  if (response.error || !response.data?.success) {
    const detail = await parseSupabaseFunctionError(response.error, response.data);
    throw new Error(friendlyEdgeFunctionError(detail, 'Falha na verificação do criativo.'));
  }

  const check = response.data.check as CreativeRuleCheck;
  return {
    creativeId: creative.id,
    name: creative.name || creative.id,
    imageUrl: creative.image_url ?? null,
    externalId: creative.external_id ?? null,
    check,
  };
}

async function processCreativesInParallel(
  creatives: BatchCreativeMeta[],
  ruleIds: string[] | undefined,
  onProgress: (done: number, currentCreative: BatchCreativeMeta) => void,
): Promise<BatchCheckResultItem[]> {
  const results: BatchCheckResultItem[] = new Array(creatives.length);
  let done = 0;

  for (let i = 0; i < creatives.length; i += BATCH_CONCURRENCY) {
    const wave = creatives.slice(i, i + BATCH_CONCURRENCY);
    const waveResults = await Promise.all(
      wave.map(async (creative, waveIndex) => {
        const item = await checkSingleCreative(creative, ruleIds, false);
        const globalIndex = i + waveIndex;
        results[globalIndex] = item;
        done += 1;
        onProgress(done, creative);
        return item;
      }),
    );
    void waveResults;
  }

  return results;
}

export function useBatchCreativeRuleCheck() {
  const { user } = useAuth();
  const companyId = user?.company?.id;
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);

  const invalidateCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['creative-rule-check'] });
    queryClient.invalidateQueries({ queryKey: ['creative-rule-checks-batch'] });
    queryClient.invalidateQueries({ queryKey: ['compliance-summary', companyId] });
    queryClient.invalidateQueries({ queryKey: ['branding-compliance'] });
  }, [queryClient, companyId]);

  const runBatch = useCallback(
    async ({
      creatives,
      ruleIds,
      limit = BATCH_CHUNK_SIZE,
      onProgress,
    }: {
      creatives: BatchCreativeMeta[];
      ruleIds?: string[];
      limit?: number;
      onProgress?: (p: BatchProgress) => void;
    }): Promise<{ results: BatchCheckResultItem[]; nonCompliant: BatchCheckResultItem[] }> => {
      if (!companyId || creatives.length === 0) {
        return { results: [], nonCompliant: [] };
      }

      if (creatives.length > limit) {
        toast.warning(`Analisando os primeiros ${limit} criativos para evitar timeout.`);
      }

      const queue = creatives.slice(0, limit);
      setIsRunning(true);
      const batchTotal = Math.ceil(queue.length / BATCH_CHUNK_SIZE);

      try {
        const results = await processCreativesInParallel(queue, ruleIds, (done, creative) => {
          const progressState: BatchProgress = {
            current: done,
            total: queue.length,
            creativeName: creative.name || creative.id,
            batchIndex: Math.ceil(done / BATCH_CHUNK_SIZE),
            batchTotal,
          };
          setProgress(progressState);
          onProgress?.(progressState);
        });

        invalidateCaches();

        const nonCompliant = results.filter(
          r => r.check.overall_status === 'rejected' || r.check.overall_status === 'warning',
        );

        return { results, nonCompliant };
      } catch (error) {
        console.error('Batch rule check failed:', error);
        const msg = error instanceof Error ? error.message : String(error);
        toast.error(friendlyEdgeFunctionError(msg, 'Erro ao verificar criativos. Tente novamente.'));
        throw error;
      } finally {
        setIsRunning(false);
        setProgress(null);
      }
    },
    [companyId, invalidateCaches],
  );

  const runPagedBatch = useCallback(
    async ({
      creatives,
      ruleIds,
      onProgress,
    }: {
      creatives: BatchCreativeMeta[];
      ruleIds?: string[];
      onProgress?: (p: BatchProgress) => void;
    }): Promise<{ results: BatchCheckResultItem[]; nonCompliant: BatchCheckResultItem[] }> => {
      if (!companyId || creatives.length === 0) {
        return { results: [], nonCompliant: [] };
      }

      setIsRunning(true);
      const total = creatives.length;
      const batchTotal = Math.ceil(total / BATCH_CHUNK_SIZE);

      try {
        const allResults = await processCreativesInParallel(creatives, ruleIds, (done, creative) => {
          const progressState: BatchProgress = {
            current: done,
            total,
            creativeName: creative.name || creative.id,
            batchIndex: Math.ceil(done / BATCH_CHUNK_SIZE),
            batchTotal,
          };
          setProgress(progressState);
          onProgress?.(progressState);
        });

        invalidateCaches();

        const nonCompliant = allResults.filter(
          r => r.check.overall_status === 'rejected' || r.check.overall_status === 'warning',
        );

        return { results: allResults, nonCompliant };
      } catch (error: unknown) {
        console.error('Paged batch rule check failed:', error);
        const msg = error instanceof Error ? error.message : String(error);
        toast.error(friendlyEdgeFunctionError(msg, 'Erro ao verificar criativos. Tente novamente.'));
        throw error;
      } finally {
        setIsRunning(false);
        setProgress(null);
      }
    },
    [companyId, invalidateCaches],
  );

  return { runBatch, runPagedBatch, isRunning, progress, extractFailedRules };
}
