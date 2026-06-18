/**
 * Per-rule evaluation cache — DB layer + pure helpers for Edge Functions.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { BRANDING_EVAL_VERSION } from './creativeCopyPlacement.ts';

export type RuleKind = 'branding' | 'performance';

export interface RuleCheckResultLike {
  rule_id: string;
  rule_name?: string;
  rule_type?: string;
  severity?: string;
  passed: boolean;
  reason?: string;
}

export interface CachedEvaluationRow {
  rule_id: string;
  rule_kind: RuleKind;
  passed: boolean;
  reason: string;
  severity: string | null;
  result_json: Record<string, unknown>;
  input_fingerprint: string;
  evaluated_at: string;
}

export function fingerprintHash(parts: Array<string | number | boolean | null | undefined>): string {
  const payload = parts.map((p) => (p == null ? '' : String(p))).join('|');
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function computeBrandingFingerprint(
  rule: { id: string; updated_at?: string | null; logo_url?: string | null },
  creative: Record<string, unknown>,
): string {
  return fingerprintHash([
    'branding',
    BRANDING_EVAL_VERSION,
    rule.id,
    rule.updated_at ?? '',
    rule.logo_url ?? '',
    creative.updated_at ?? '',
    creative.image_url ?? '',
    creative.video_url ?? '',
    creative.text ?? '',
    creative.headline ?? '',
    creative.description ?? '',
  ]);
}

export function computePerformanceFingerprint(
  rule: { id: string; updated_at?: string | null },
  creative: Record<string, unknown>,
): string {
  return fingerprintHash([
    'performance',
    rule.id,
    rule.updated_at ?? '',
    creative.ctr ?? 0,
    creative.cpc ?? 0,
    creative.spend ?? 0,
    creative.impressions ?? 0,
    creative.clicks ?? 0,
    creative.conversions ?? 0,
  ]);
}

export function computeCreativeFingerprint(creative: Record<string, unknown>): string {
  return fingerprintHash([
    'creative',
    creative.updated_at ?? '',
    creative.image_url ?? '',
    creative.video_url ?? '',
    creative.text ?? '',
    creative.headline ?? '',
    creative.description ?? '',
    creative.ctr ?? 0,
    creative.cpc ?? 0,
    creative.spend ?? 0,
  ]);
}

export function isFingerprintValid(cached: CachedEvaluationRow | undefined, expected: string): boolean {
  return !!cached && cached.input_fingerprint === expected;
}

export function rulesNeedingEvaluation(
  requestedIds: string[],
  cachedByRuleId: Map<string, CachedEvaluationRow>,
  expectedFingerprints: Map<string, string>,
  forceRefresh = false,
): string[] {
  if (forceRefresh) return [...requestedIds];
  return requestedIds.filter((id) => {
    const cached = cachedByRuleId.get(id);
    const expected = expectedFingerprints.get(id);
    if (!expected) return true;
    return !isFingerprintValid(cached, expected);
  });
}

export function mergeRuleResults<T extends { rule_id: string }>(cached: T[], fresh: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of cached) byId.set(row.rule_id, row);
  for (const row of fresh) byId.set(row.rule_id, row);
  return [...byId.values()];
}

const BLOCKING_SEVERITIES = new Set(['error', 'critical', 'high']);

export function deriveOverallStatusFromResults(
  results: Array<{ passed: boolean; severity?: string | null }>,
): 'approved' | 'warning' | 'rejected' {
  const failed = results.filter((r) => !r.passed);
  if (failed.length === 0) return 'approved';
  const hasBlocking = failed.some((r) =>
    r.severity ? BLOCKING_SEVERITIES.has(r.severity.toLowerCase()) : true,
  );
  return hasBlocking ? 'rejected' : 'warning';
}

export function deriveOverallScore(results: Array<{ passed: boolean }>): number {
  if (results.length === 0) return 100;
  const passed = results.filter((r) => r.passed).length;
  return Math.round((passed / results.length) * 100);
}

export function cachedRowToCheckResult(row: CachedEvaluationRow): RuleCheckResultLike {
  const fromJson = row.result_json as RuleCheckResultLike;
  return {
    rule_id: row.rule_id,
    rule_name: fromJson.rule_name,
    rule_type: fromJson.rule_type,
    severity: row.severity ?? fromJson.severity ?? 'warning',
    passed: row.passed,
    reason: row.reason || fromJson.reason || '',
  };
}

export function countCacheStats(
  requestedIds: string[],
  evaluatedIds: string[],
): { cached_rules: number; evaluated_rules: number } {
  const evaluatedSet = new Set(evaluatedIds);
  return {
    cached_rules: requestedIds.filter((id) => !evaluatedSet.has(id)).length,
    evaluated_rules: evaluatedSet.size,
  };
}

export async function loadCachedEvaluations(
  supabase: SupabaseClient,
  creativeId: string,
  ruleIds: string[],
  ruleKind: RuleKind,
): Promise<Map<string, CachedEvaluationRow>> {
  const map = new Map<string, CachedEvaluationRow>();
  if (ruleIds.length === 0) return map;

  const { data, error } = await supabase
    .from('creative_rule_evaluations')
    .select('rule_id, rule_kind, passed, reason, severity, result_json, input_fingerprint, evaluated_at')
    .eq('creative_id', creativeId)
    .eq('rule_kind', ruleKind)
    .in('rule_id', ruleIds);

  if (error) {
    console.warn('loadCachedEvaluations error:', error.message);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.rule_id, row as CachedEvaluationRow);
  }
  return map;
}

export async function upsertRuleEvaluations(
  supabase: SupabaseClient,
  companyId: string,
  creativeId: string,
  ruleKind: RuleKind,
  evaluations: Array<{
    rule_id: string;
    passed: boolean;
    reason: string;
    severity?: string | null;
    result_json: Record<string, unknown>;
    input_fingerprint: string;
  }>,
): Promise<void> {
  if (evaluations.length === 0) return;

  const now = new Date().toISOString();
  const rows = evaluations.map((e) => ({
    company_id: companyId,
    creative_id: creativeId,
    rule_id: e.rule_id,
    rule_kind: ruleKind,
    passed: e.passed,
    reason: e.reason,
    severity: e.severity ?? null,
    result_json: e.result_json,
    input_fingerprint: e.input_fingerprint,
    evaluated_at: now,
  }));

  const { error } = await supabase
    .from('creative_rule_evaluations')
    .upsert(rows, { onConflict: 'creative_id,rule_id,rule_kind' });

  if (error) {
    console.error('upsertRuleEvaluations error:', error.message);
    throw new Error(`Failed to persist rule cache: ${error.message}`);
  }
}

export function allRequestedRulesCached(
  requestedIds: string[],
  cachedByRuleId: Map<string, CachedEvaluationRow>,
  expectedFingerprints: Map<string, string>,
): boolean {
  if (requestedIds.length === 0) return false;
  return requestedIds.every((id) => {
    const cached = cachedByRuleId.get(id);
    const expected = expectedFingerprints.get(id);
    return expected ? isFingerprintValid(cached, expected) : false;
  });
}

export interface AuditCacheMeta {
  creative_fingerprint: string;
  branding_rule_ids: string[];
  performance_rule_ids: string[];
  policy_id: string | null;
  evaluated_at: string;
}

export function canSkipFullLlm(
  previousCache: AuditCacheMeta | null | undefined,
  creativeFingerprint: string,
  policyId: string | null,
  brandingRuleIds: string[],
  performanceRuleIds: string[],
  staleBrandingIds: string[],
  stalePerformanceIds: string[],
  forceRefresh: boolean,
): boolean {
  if (forceRefresh) return false;
  if (!previousCache) return false;
  if (previousCache.creative_fingerprint !== creativeFingerprint) return false;
  if (previousCache.policy_id !== policyId) return false;
  if (staleBrandingIds.length > 0 || stalePerformanceIds.length > 0) return false;

  const prevBranding = new Set(previousCache.branding_rule_ids);
  const prevPerf = new Set(previousCache.performance_rule_ids);
  const brandingSubset = brandingRuleIds.every((id) => prevBranding.has(id));
  const perfSubset = performanceRuleIds.every((id) => prevPerf.has(id));
  return brandingSubset && perfSubset;
}

export function mergeAiAnalysis(
  previous: Record<string, unknown> | null,
  fresh: Record<string, unknown> | null,
  options: { reuseVisual: boolean },
): Record<string, unknown> | null {
  if (!fresh && !previous) return null;
  if (!previous) return fresh;
  if (!fresh) return previous;

  const merged: Record<string, unknown> = { ...previous, ...fresh };

  if (options.reuseVisual && previous.visual_analysis) {
    merged.visual_analysis = previous.visual_analysis;
  }
  if (options.reuseVisual && typeof previous.visual_score === 'number' && fresh.visual_score == null) {
    merged.visual_score = previous.visual_score;
  }

  const normalizeForDedupe = (s: string) => s.trim().toLowerCase();

  const mergeStringArrays = (key: string) => {
    const prev = (previous[key] as string[] | undefined) ?? [];
    const next = (fresh[key] as string[] | undefined) ?? [];
    if (prev.length || next.length) {
      const seen = new Set<string>();
      const combined: string[] = [];
      for (const item of [...prev, ...next]) {
        if (typeof item !== 'string' || !item.trim()) continue;
        const keyNorm = normalizeForDedupe(item);
        if (seen.has(keyNorm)) continue;
        seen.add(keyNorm);
        combined.push(item);
      }
      merged[key] = combined;
    }
  };
  mergeStringArrays('strengths');
  mergeStringArrays('weaknesses');
  mergeStringArrays('suggestions');
  mergeStringArrays('action_plan');

  for (const textKey of ['executive_summary', 'tone_analysis'] as const) {
    const freshVal = fresh[textKey];
    if (typeof freshVal === 'string' && freshVal.trim()) {
      merged[textKey] = freshVal;
    }
  }

  const mergeCompliance = (key: string) => {
    const prev = (previous[key] as Array<{ rule_name?: string; passed?: boolean }> | undefined) ?? [];
    const next = (fresh[key] as Array<{ rule_name?: string; passed?: boolean }> | undefined) ?? [];
    if (!next.length) {
      merged[key] = prev;
      return;
    }
    const byName = new Map<string, (typeof next)[0]>();
    for (const row of prev) {
      const k = row.rule_name ?? JSON.stringify(row);
      byName.set(k, row);
    }
    for (const row of next) {
      const k = row.rule_name ?? JSON.stringify(row);
      byName.set(k, row);
    }
    merged[key] = [...byName.values()];
  };
  mergeCompliance('rules_compliance');
  mergeCompliance('performance_rules_compliance');

  return merged;
}
