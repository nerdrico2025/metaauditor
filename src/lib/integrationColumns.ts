/** Colunas seguras para expor ao browser — nunca incluir tokens OAuth. */
export const INTEGRATION_PUBLIC_COLUMNS =
  'id, company_id, platform, account_id, account_name, status, last_sync_at, token_expires_at, permissions, user_id, created_at, updated_at, is_monitored, sync_preferences' as const;

export const INTEGRATION_SENSITIVE_COLUMNS = ['access_token', 'refresh_token'] as const;

export function assertIntegrationSelectSafe(select: string): void {
  for (const column of INTEGRATION_SENSITIVE_COLUMNS) {
    if (select.includes('*') || select.includes(column)) {
      throw new Error(`Select de integrations não pode incluir "${column}" no client`);
    }
  }
}

assertIntegrationSelectSafe(INTEGRATION_PUBLIC_COLUMNS);
