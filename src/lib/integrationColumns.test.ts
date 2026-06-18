import { describe, expect, it } from 'vitest';
import {
  INTEGRATION_PUBLIC_COLUMNS,
  INTEGRATION_SENSITIVE_COLUMNS,
  assertIntegrationSelectSafe,
} from '@/lib/integrationColumns';
import { requireCompanyId } from '@/lib/supabaseScope';

describe('integrationColumns', () => {
  it('public column list excludes OAuth tokens', () => {
    for (const column of INTEGRATION_SENSITIVE_COLUMNS) {
      expect(INTEGRATION_PUBLIC_COLUMNS).not.toContain(column);
    }
  });

  it('assertIntegrationSelectSafe rejects wildcard and token columns', () => {
    expect(() => assertIntegrationSelectSafe('*')).toThrow(/access_token|refresh_token/);
    expect(() => assertIntegrationSelectSafe('id, access_token')).toThrow();
    expect(() => assertIntegrationSelectSafe(INTEGRATION_PUBLIC_COLUMNS)).not.toThrow();
  });
});

describe('requireCompanyId', () => {
  it('returns company id when present', () => {
    expect(requireCompanyId('abc-123')).toBe('abc-123');
  });

  it('throws when company id is missing', () => {
    expect(() => requireCompanyId(null)).toThrow('Company ID is required');
    expect(() => requireCompanyId(undefined)).toThrow('Company ID is required');
  });
});
