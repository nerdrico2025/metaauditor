import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tag } from './useTags';
import { fetchAllPaginated, fetchAllPaginatedInChunks } from '@/lib/supabasePaginate';
import { useMonitoredCampaignScope } from './useMonitoredCampaignScope';

export interface Creative {
    id: string;
    external_id: string;
    name: string;
    type: string;
    creative_format: string;
    platform: string;
    status: string;
    headline: string | null;
    description: string | null;
    image_url: string | null;
    video_url: string | null;
    call_to_action: string | null;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    ctr: number;
    cpc: number;
    performance_score: number;
    last_audit_at: string | null;
    created_at: string;
    campaigns?: { name: string; status?: string };
    tags?: { tag: Tag }[];
}

export interface CreativeFilters {
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'spend' | 'clicks' | 'impressions' | 'ctr' | 'conversions' | 'created_at';
    sortOrder?: 'asc' | 'desc';
    integrationIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    campaignId?: string;
    adSetId?: string;
    /** When set, only creatives with these IDs are returned (compliance/rule filters). */
    restrictToCreativeIds?: string[];
}

const ID_CHUNK = 200;

async function fetchCreativesByIdChunks(
    buildForIds: (ids: string[]) => ReturnType<typeof supabase.from>,
    ids: string[],
): Promise<any[]> {
    if (ids.length === 0) return [];
    const rows: any[] = [];
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
        const chunk = ids.slice(i, i + ID_CHUNK);
        const chunkRows = await fetchAllPaginated<any>(() => buildForIds(chunk));
        rows.push(...chunkRows);
    }
    return rows.map((c: any) => ({ ...c, tags: c.creative_tags }));
}

function applyCreativeScope(
    query: any,
    companyId: string,
    scope: { monitoredIntegrationIds: string[] },
    campaignId?: string,
): any {
    let q = query.eq('company_id', companyId);

    if (campaignId) {
        q = q.eq('campaign_id', campaignId);
    } else {
        q = q.in('campaigns.integration_id', scope.monitoredIntegrationIds);
    }

    return q;
}

export function useTopCreatives(limit: number = 5, integrationIds?: string[]) {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const { data: scope } = useMonitoredCampaignScope(integrationIds);

    return useQuery({
        queryKey: ['top-creatives', companyId, limit, integrationIds, scope?.monitoredIntegrationIds],
        queryFn: async (): Promise<Creative[]> => {
            if (!companyId || !scope) throw new Error('No company ID');

            if (scope.monitoredIntegrationIds.length === 0) return [];

            const topAudits = await fetchAllPaginated<any>(() =>
                (supabase as any)
                    .from('audits')
                    .select('creative_id, performance_score, created_at')
                    .not('performance_score', 'is', null)
                    .order('created_at', { ascending: false }),
            );

            const latestScoreByCreative = new Map<string, number>();
            for (const a of topAudits) {
                if (!latestScoreByCreative.has(a.creative_id)) {
                    latestScoreByCreative.set(a.creative_id, Number(a.performance_score) || 0);
                }
            }

            const rankedIds = Array.from(latestScoreByCreative.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([id]) => id);

            if (rankedIds.length === 0) return [];

            const { data, error } = await supabase
                .from('creatives')
                .select('*, campaigns!inner(name, status, integration_id), creative_tags(tag:tags(*))')
                .eq('company_id', companyId)
                .in('campaigns.integration_id', scope.monitoredIntegrationIds)
                .in('id', rankedIds.slice(0, 200));

            if (error) {
                console.error('Error in useTopCreatives:', error);
                throw error;
            }

            const enriched =
                (data as any)?.map((c: any) => ({
                    ...c,
                    tags: c.creative_tags,
                    performance_score: latestScoreByCreative.get(c.id) ?? 0,
                })) || [];

            enriched.sort(
                (a: any, b: any) => (b.performance_score || 0) - (a.performance_score || 0),
            );
            return enriched.slice(0, limit);
        },
        enabled: !!companyId && scope !== undefined,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreatives(filters: CreativeFilters = {}) {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const { data: scope } = useMonitoredCampaignScope(filters.integrationIds);

    return useQuery({
        queryKey: ['creatives', companyId, filters, scope?.monitoredIntegrationIds],
        queryFn: async (): Promise<{
            creatives: Creative[];
            total: number;
            typeCounts: { video: number; image: number; carousel: number };
        }> => {
            if (!companyId || !scope) throw new Error('No company ID');

            if (filters.campaignId) {
                if (!scope.validCampaignIds.includes(filters.campaignId)) {
                    return {
                        creatives: [],
                        total: 0,
                        typeCounts: { video: 0, image: 0, carousel: 0 },
                    };
                }
            } else if (scope.monitoredIntegrationIds.length === 0) {
                return { creatives: [], total: 0, typeCounts: { video: 0, image: 0, carousel: 0 } };
            }

            const useInnerJoin = !filters.campaignId;
            const selectFields = useInnerJoin
                ? '*, campaigns!inner(name, status, integration_id), creative_tags(tag:tags(*))'
                : '*, campaigns(name, status), creative_tags(tag:tags(*))';

            const hasDateFilter = !!filters.dateFrom && !!filters.dateTo;
            const hasIdRestriction = filters.restrictToCreativeIds !== undefined;
            const needsClientSort = hasDateFilter || hasIdRestriction;

            const buildBase = (idFilter?: string[]) => {
                let q = supabase
                    .from('creatives')
                    .select(selectFields, {
                        count: idFilter ? undefined : 'exact',
                    });
                q = applyCreativeScope(q, companyId, scope, filters.campaignId);
                if (idFilter?.length) q = q.in('id', idFilter);
                if (filters.adSetId) q = q.eq('ad_set_id', filters.adSetId);
                if (filters.search) q = q.ilike('name', `%${filters.search}%`);
                if (filters.type && filters.type !== 'all') q = q.eq('type', filters.type);
                if (filters.status) q = q.ilike('status', filters.status);
                return q;
            };

            let creatives: any[] = [];
            let totalCount = 0;

            if (!needsClientSort) {
                let query = buildBase();
                const sortColumn = filters.sortBy || 'created_at';
                query = query.order(sortColumn, {
                    ascending: filters.sortOrder === 'asc',
                });
                if (filters.limit) {
                    const start = filters.offset || 0;
                    const end = start + filters.limit - 1;
                    query = query.range(start, end);
                }
                const { data, error, count } = await query;
                if (error) {
                    console.error('Error fetching creatives:', error);
                    throw error;
                }
                creatives = (data as any)?.map((c: any) => ({ ...c, tags: c.creative_tags })) || [];
                totalCount = count || 0;
            } else if (hasIdRestriction) {
                const allowedIds = filters.restrictToCreativeIds ?? [];
                if (allowedIds.length === 0) {
                    return {
                        creatives: [],
                        total: 0,
                        typeCounts: { video: 0, image: 0, carousel: 0 },
                    };
                }

                creatives = await fetchCreativesByIdChunks(
                    (ids) => buildBase(ids).order('created_at', { ascending: false }),
                    allowedIds,
                );
                totalCount = creatives.length;
            } else {
                const allRows = await fetchAllPaginated<any>(() =>
                    buildBase().order('created_at', { ascending: false }),
                );
                creatives = allRows.map((c: any) => ({ ...c, tags: c.creative_tags }));
                totalCount = creatives.length;
            }

            if (needsClientSort && creatives.length > 0) {
                if (hasDateFilter) {
                    const ids = creatives.map((c: any) => c.id);
                    const metrics = await fetchAllPaginatedInChunks<any>(
                        ids,
                        (chunkIds) =>
                            (supabase as any)
                                .from('creative_metrics')
                                .select('creative_id, impressions, clicks, spend, conversions, reach')
                                .in('creative_id', chunkIds)
                                .gte('date', filters.dateFrom)
                                .lte('date', filters.dateTo),
                    );

                    const totals = new Map<
                        string,
                        {
                            impressions: number;
                            clicks: number;
                            spend: number;
                            conversions: number;
                            reach: number;
                        }
                    >();
                    metrics.forEach((m: any) => {
                        const cur = totals.get(m.creative_id) || {
                            impressions: 0,
                            clicks: 0,
                            spend: 0,
                            conversions: 0,
                            reach: 0,
                        };
                        cur.impressions += Number(m.impressions) || 0;
                        cur.clicks += Number(m.clicks) || 0;
                        cur.spend += Number(m.spend) || 0;
                        cur.conversions += Number(m.conversions) || 0;
                        cur.reach = Math.max(cur.reach, Number(m.reach) || 0);
                        totals.set(m.creative_id, cur);
                    });
                    creatives = creatives.map((c: any) => {
                        const t = totals.get(c.id);
                        if (!t) {
                            const denormSpend = Number(c.spend) || 0;
                            const denormImpressions = Number(c.impressions) || 0;
                            if (denormSpend > 0 || denormImpressions > 0) {
                                const ctr =
                                    denormImpressions > 0
                                        ? ((Number(c.clicks) || 0) / denormImpressions) * 100
                                        : Number(c.ctr) || 0;
                                const cpc =
                                    (Number(c.clicks) || 0) > 0
                                        ? denormSpend / (Number(c.clicks) || 0)
                                        : Number(c.cpc) || 0;
                                return {
                                    ...c,
                                    spend: denormSpend,
                                    impressions: denormImpressions,
                                    clicks: Number(c.clicks) || 0,
                                    conversions: Number(c.conversions) || 0,
                                    reach: Number(c.reach) || 0,
                                    ctr,
                                    cpc,
                                };
                            }
                            return {
                                ...c,
                                impressions: 0,
                                clicks: 0,
                                spend: 0,
                                conversions: 0,
                                reach: 0,
                                ctr: 0,
                                cpc: 0,
                            };
                        }
                        const ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
                        const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
                        return { ...c, ...t, ctr, cpc };
                    });
                }

                const sortKey = filters.sortBy || 'spend';
                const asc = filters.sortOrder === 'asc';
                creatives.sort((a: any, b: any) => {
                    const av = Number(a[sortKey]) || 0;
                    const bv = Number(b[sortKey]) || 0;
                    if (av === bv) return 0;
                    return asc ? av - bv : bv - av;
                });

                totalCount = creatives.length;
                if (filters.limit) {
                    const start = filters.offset || 0;
                    creatives = creatives.slice(start, start + filters.limit);
                }
            }

            const buildTypeCountQuery = (type: string) => {
                const countSelect = useInnerJoin
                    ? 'id, campaigns!inner(integration_id)'
                    : 'id, campaigns(integration_id)';
                let q = supabase
                    .from('creatives')
                    .select(countSelect, { count: 'exact', head: true })
                    .eq('company_id', companyId)
                    .eq('type', type);
                return applyCreativeScope(q, companyId, scope, filters.campaignId);
            };

            const [videoCount, imageCount, carouselCount] = await Promise.all(
                ['video', 'image', 'carousel'].map(async (type) => {
                    const { count: c } = await buildTypeCountQuery(type);
                    return c || 0;
                }),
            );

            return {
                creatives,
                total: totalCount,
                typeCounts: { video: videoCount, image: imageCount, carousel: carouselCount },
            };
        },
        enabled: !!companyId && scope !== undefined,
        staleTime: 2 * 60 * 1000,
    });
}

export function useCreativesCount() {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const { data: scope } = useMonitoredCampaignScope();

    return useQuery({
        queryKey: ['creatives-count', companyId, scope?.monitoredIntegrationIds],
        queryFn: async (): Promise<number> => {
            if (!companyId || !scope) throw new Error('No company ID');

            if (scope.monitoredIntegrationIds.length === 0) return 0;

            const { count, error } = await supabase
                .from('creatives')
                .select('id, campaigns!inner(integration_id)', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .in('campaigns.integration_id', scope.monitoredIntegrationIds);

            if (error) throw error;
            return count || 0;
        },
        enabled: !!companyId && scope !== undefined,
        staleTime: 5 * 60 * 1000,
    });
}
