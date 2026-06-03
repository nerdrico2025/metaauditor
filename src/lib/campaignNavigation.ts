/** URL helpers for Meta-style Campanhas → Conjuntos → Criativos drill-down */

export function conjuntosPath(campaignId?: string | null): string {
  if (!campaignId) return '/conjuntos';
  return `/conjuntos?campaignId=${encodeURIComponent(campaignId)}`;
}

export function criativosPath(params?: { campaignId?: string | null; adSetId?: string | null }): string {
  const search = new URLSearchParams();
  if (params?.campaignId) search.set('campaignId', params.campaignId);
  if (params?.adSetId) search.set('adSetId', params.adSetId);
  const q = search.toString();
  return q ? `/criativos?${q}` : '/criativos';
}

export function campanhaIaPath(campaignId: string): string {
  return `/campanhas/${campaignId}`;
}

export function conjuntoIaPath(campaignId: string, adSetId: string): string {
  return `/campanhas/${campaignId}/conjuntos/${adSetId}`;
}

export function isConjuntosRoute(pathname: string): boolean {
  return pathname === '/conjuntos' || /^\/campanhas\/[^/]+\/conjuntos\/[^/]+$/.test(pathname);
}

export function isCriativosRoute(pathname: string): boolean {
  return pathname === '/criativos' || pathname.startsWith('/criativos/');
}

export function isCampanhasListRoute(pathname: string): boolean {
  return pathname === '/campanhas';
}
