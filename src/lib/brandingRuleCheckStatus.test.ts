import { describe, expect, it } from 'vitest';
import {
  brandingBadgeStatus,
  resolveBrandingCheckStatus,
} from '@/lib/brandingRuleCheckStatus';

describe('brandingRuleCheckStatus', () => {
  it('downgrades approved when failed rules exist', () => {
    expect(
      resolveBrandingCheckStatus('approved', [
        { severity: 'error' },
      ]),
    ).toBe('rejected');
  });

  it('keeps rejected when failed rules exist', () => {
    expect(
      resolveBrandingCheckStatus('rejected', [
        { severity: 'warning' },
      ]),
    ).toBe('rejected');
  });

  it('maps warning to rejected badge', () => {
    expect(brandingBadgeStatus('warning')).toBe('rejected');
  });

  it('returns pending without check data', () => {
    expect(resolveBrandingCheckStatus(undefined, [])).toBe('pending');
  });
});
