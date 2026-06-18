export type BrandingCheckDisplayStatus = 'approved' | 'rejected' | 'warning' | 'pending';

export type BrandingBadgeStatus = 'approved' | 'rejected' | 'pending';

interface FailedRuleLike {
  severity?: string | null;
}

const BLOCKING_SEVERITIES = new Set(['error', 'critical', 'high']);

/** Align UI status with failed rules when the stored overall_status is stale or optimistic. */
export function resolveBrandingCheckStatus(
  overallStatus: string | null | undefined,
  failedRules: FailedRuleLike[] = [],
): BrandingCheckDisplayStatus {
  const failedCount = failedRules.length;
  const normalized = overallStatus?.toLowerCase();

  if (failedCount > 0) {
    if (normalized === 'rejected' || normalized === 'warning') {
      return normalized;
    }
    const hasBlocking = failedRules.some((rule) =>
      rule.severity ? BLOCKING_SEVERITIES.has(rule.severity.toLowerCase()) : true,
    );
    return hasBlocking ? 'rejected' : 'warning';
  }

  if (normalized === 'approved') return 'approved';
  if (normalized === 'rejected' || normalized === 'warning') {
    return normalized;
  }
  return 'pending';
}

/** Collapse warning into rejected for list badges (briefing #3). */
export function brandingBadgeStatus(
  status: BrandingCheckDisplayStatus,
): BrandingBadgeStatus {
  if (status === 'approved') return 'approved';
  if (status === 'rejected' || status === 'warning') return 'rejected';
  return 'pending';
}

export function isBrandingCheckNonCompliant(status: BrandingCheckDisplayStatus): boolean {
  return status === 'rejected' || status === 'warning';
}

export function brandingCheckStatusLabel(status: BrandingCheckDisplayStatus): string {
  if (status === 'approved') return 'Aprovado';
  if (status === 'rejected') return 'Reprovado';
  if (status === 'warning') return 'Com ressalvas';
  return 'Não analisado';
}
