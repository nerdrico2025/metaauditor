/**
 * Garante company_id antes de queries tenant-scoped (constituição: toda query filtra por company_id).
 */
export function requireCompanyId(companyId: string | null | undefined): string {
  if (!companyId) {
    throw new Error('Company ID is required');
  }
  return companyId;
}
