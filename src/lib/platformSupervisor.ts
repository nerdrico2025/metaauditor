export const PLATFORM_SUPERVISOR_EMAILS = [
  'filipesenna59@gmail.com',
  'denilson.oliveira@clickhero.com',
  'rafael@clickhero.com.br',
] as const;

export function isPlatformSupervisorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return PLATFORM_SUPERVISOR_EMAILS.some((allowed) => allowed === normalized);
}
