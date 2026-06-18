/**
 * Pure helpers for per-rule evaluation cache (shared with Vitest).
 * Edge functions mirror this logic in supabase/functions/_shared/ruleEvaluationCache.ts
 */

/** Bump when branding evaluation logic/prompts change to invalidate stale cache rows. */
export const BRANDING_EVAL_VERSION = 'copy-placement-v1';

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

export interface CreativeLike {
  updated_at?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  text?: string | null;
  headline?: string | null;
  description?: string | null;
  ctr?: number | string | null;
  cpc?: number | string | null;
  spend?: number | string | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  conversions?: number | string | null;
}

export interface BrandingRuleLike {
  id: string;
  updated_at?: string | null;
  logo_url?: string | null;
}

export interface PerformanceRuleLike {
  id: string;
  updated_at?: string | null;
}

/** Stable string hash for fingerprint inputs (djb2). */
export function fingerprintHash(parts: Array<string | number | boolean | null | undefined>): string {
  const payload = parts.map((p) => (p == null ? '' : String(p))).join('|');
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function computeBrandingFingerprint(rule: BrandingRuleLike, creative: CreativeLike): string {
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

export function computePerformanceFingerprint(rule: PerformanceRuleLike, creative: CreativeLike): string {
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

export function computeCreativeFingerprint(creative: CreativeLike): string {
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

/** Fresh results override cached entries with the same rule_id. */
export function mergeRuleResults<T extends { rule_id: string }>(
  cached: T[],
  fresh: T[],
): T[] {
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
  const fromJson = row.result_json as unknown as RuleCheckResultLike;
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
  const evaluated_rules = evaluatedSet.size;
  const cached_rules = requestedIds.filter((id) => !evaluatedSet.has(id)).length;
  return { cached_rules, evaluated_rules };
}
