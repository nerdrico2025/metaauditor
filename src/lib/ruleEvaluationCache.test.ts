import { describe, expect, it } from 'vitest';
import {
  computeBrandingFingerprint,
  computeCreativeFingerprint,
  computePerformanceFingerprint,
  countCacheStats,
  deriveOverallScore,
  deriveOverallStatusFromResults,
  fingerprintHash,
  isFingerprintValid,
  mergeRuleResults,
  rulesNeedingEvaluation,
} from './ruleEvaluationCache';

describe('ruleEvaluationCache', () => {
  const creative = {
    updated_at: '2026-01-01T00:00:00Z',
    image_url: 'https://example.com/img.jpg',
    text: 'Compre agora',
    ctr: 1.2,
    cpc: 0.5,
    impressions: 1000,
    clicks: 12,
  };

  const brandingRule = {
    id: 'rule-a',
    updated_at: '2026-01-01T00:00:00Z',
    logo_url: null,
  };

  it('produces stable fingerprints for same inputs', () => {
    const fp1 = computeBrandingFingerprint(brandingRule, creative);
    const fp2 = computeBrandingFingerprint(brandingRule, creative);
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThan(0);
  });

  it('invalidates branding fingerprint when creative text changes', () => {
    const before = computeBrandingFingerprint(brandingRule, creative);
    const after = computeBrandingFingerprint(brandingRule, { ...creative, text: 'Outro texto' });
    expect(before).not.toBe(after);
  });

  it('invalidates performance fingerprint when metrics change', () => {
    const perfRule = { id: 'perf-1', updated_at: '2026-01-01' };
    const before = computePerformanceFingerprint(perfRule, creative);
    const after = computePerformanceFingerprint(perfRule, { ...creative, ctr: 2.5 });
    expect(before).not.toBe(after);
  });

  it('mergeRuleResults prefers fresh over cached for same rule_id', () => {
    const cached = [{ rule_id: 'a', passed: true, reason: 'ok' }];
    const fresh = [{ rule_id: 'a', passed: false, reason: 'fail' }];
    const merged = mergeRuleResults(cached, fresh);
    expect(merged).toHaveLength(1);
    expect(merged[0].passed).toBe(false);
  });

  it('mergeRuleResults combines distinct rules', () => {
    const merged = mergeRuleResults(
      [{ rule_id: 'a', passed: true }],
      [{ rule_id: 'b', passed: false }],
    );
    expect(merged).toHaveLength(2);
  });

  it('rulesNeedingEvaluation returns stale ids only', () => {
    const fp = computeBrandingFingerprint(brandingRule, creative);
    const cached = new Map([
      [
        'rule-a',
        {
          rule_id: 'rule-a',
          rule_kind: 'branding' as const,
          passed: true,
          reason: 'ok',
          severity: 'info',
          result_json: {},
          input_fingerprint: fp,
          evaluated_at: '2026-01-01',
        },
      ],
    ]);
    const expected = new Map([['rule-a', fp], ['rule-b', fingerprintHash(['b'])]]);
    const stale = rulesNeedingEvaluation(['rule-a', 'rule-b'], cached, expected);
    expect(stale).toEqual(['rule-b']);
  });

  it('isFingerprintValid detects mismatch', () => {
    const row = {
      rule_id: 'x',
      rule_kind: 'branding' as const,
      passed: true,
      reason: '',
      severity: null,
      result_json: {},
      input_fingerprint: 'abc',
      evaluated_at: '',
    };
    expect(isFingerprintValid(row, 'abc')).toBe(true);
    expect(isFingerprintValid(row, 'def')).toBe(false);
  });

  it('deriveOverallStatusFromResults maps severities', () => {
    expect(deriveOverallStatusFromResults([])).toBe('approved');
    expect(
      deriveOverallStatusFromResults([{ passed: false, severity: 'error' }]),
    ).toBe('rejected');
    expect(
      deriveOverallStatusFromResults([{ passed: false, severity: 'warning' }]),
    ).toBe('warning');
  });

  it('deriveOverallScore calculates pass rate', () => {
    expect(deriveOverallScore([{ passed: true }, { passed: false }])).toBe(50);
    expect(deriveOverallScore([])).toBe(100);
  });

  it('countCacheStats splits cached vs evaluated', () => {
    expect(countCacheStats(['a', 'b', 'c'], ['c'])).toEqual({
      cached_rules: 2,
      evaluated_rules: 1,
    });
  });

  it('computeCreativeFingerprint changes with creative assets', () => {
    const fp1 = computeCreativeFingerprint(creative);
    const fp2 = computeCreativeFingerprint({ ...creative, image_url: 'https://other.jpg' });
    expect(fp1).not.toBe(fp2);
  });
});
