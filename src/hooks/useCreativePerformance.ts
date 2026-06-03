import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MetricsPeriod } from './useCompanyMetrics';
import { fetchAllPaginated, fetchAllPaginatedInChunks } from '@/lib/supabasePaginate';
import { integrationIdsKey, type MonitoredCampaignScope } from '@/hooks/useMonitoredCampaignScope';

export interface CreativePerformance {
    format: 'image' | 'video' | 'mixed';
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    ctr: number;
    cpa: number;
    cpc: number;
    cpm: number;
    performance_score: number;
}

export interface TopCreative {
    id: string;
    name: string;
    imageUrl: string | null;
    videoUrl: string | null;
    format: 'image' | 'video';
    ctr: number;
    conversions: number;
    spend: number;
    roas?: number; // Optional if not available
    headline?: string | null;
}

interface CreativeData {
    formatBatle: {
        video: CreativePerformance & { count: number; performance_score: number };
        image: CreativePerformance & { count: number; performance_score: number };
    };
    topCreatives: TopCreative[];
    topVideo: TopCreative[];
    topImage: TopCreative[];
}

const EMPTY_CREATIVE_DATA: CreativeData = {
    formatBatle: {
        video: { format: 'video', impressions: 0, clicks: 0, conversions: 0, spend: 0, ctr: 0, cpa: 0, cpc: 0, cpm: 0, performance_score: 0, count: 0 },
        image: { format: 'image', impressions: 0, clicks: 0, conversions: 0, spend: 0, ctr: 0, cpa: 0, cpc: 0, cpm: 0, performance_score: 0, count: 0 },
    },
    topCreatives: [],
    topVideo: [],
    topImage: [],
};

export function useCreativePerformance(
    period?: MetricsPeriod,
    accountId?: string,
    integrationIds?: string[],
    campaignScope?: MonitoredCampaignScope | null,
    scopeLoading?: boolean,
) {
    const { user } = useAuth();

    return useQuery({
        queryKey: ['creative-performance', user?.company_id, period, accountId, integrationIdsKey(integrationIds), campaignScope?.monitoredIntegrationIds.length ?? 'unset'],
        queryFn: async (): Promise<CreativeData> => {
            if (campaignScope && campaignScope.monitoredIntegrationIds.length === 0) {
                return EMPTY_CREATIVE_DATA;
            }

            const companyId = user?.company_id;
            if (!companyId) return EMPTY_CREATIVE_DATA;

            let integrationFilterIds: string[];
            if (campaignScope) {
                integrationFilterIds = campaignScope.monitoredIntegrationIds;
            } else if (accountId && accountId !== 'all') {
                integrationFilterIds = [accountId];
            } else if (integrationIds && integrationIds.length > 0) {
                integrationFilterIds = integrationIds;
            } else {
                const { data: monitored, error } = await supabase
                    .from('integrations')
                    .select('id, is_monitored')
                    .eq('company_id', companyId);
                if (error) throw error;
                integrationFilterIds = (monitored ?? [])
                    .filter((i) => i.is_monitored === true)
                    .map((i) => i.id);
            }

            if (integrationFilterIds.length === 0) {
                return EMPTY_CREATIVE_DATA;
            }

            const data = await fetchAllPaginated<any>(() => {
                let q = supabase
                    .from('creatives')
                    .select(`
          id,
          name,
          image_url,
          video_url,
          detected_media_type,
          impressions,
          clicks,
          conversions,
          spend,
          cpc,
          ctr,
          campaign_id,
          campaigns!inner(integration_id)
        `)
                    .eq('company_id', companyId);
                if (accountId && accountId !== 'all') {
                    q = q.eq('campaigns.integration_id', accountId);
                } else {
                    q = q.in('campaigns.integration_id', integrationFilterIds);
                }
                return q;
            });

            // Enrich with each creative's latest audit performance_score.
            // creatives.performance_score is a stale column never written by the
            // sync — the live value lives on audits.performance_score.
            const creativeIds = data.map((c: any) => c.id);
            const auditScores = new Map<string, number>();
            if (creativeIds.length > 0) {
                const auditRows = await fetchAllPaginatedInChunks<any>(
                    creativeIds,
                    (chunk) =>
                        (supabase as any)
                            .from('audits')
                            .select('creative_id, performance_score, created_at')
                            .in('creative_id', chunk)
                            .not('performance_score', 'is', null),
                );
                auditRows.sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                );
                for (const a of auditRows) {
                    if (!auditScores.has(a.creative_id)) {
                        auditScores.set(a.creative_id, Number(a.performance_score) || 0);
                    }
                }
            }

            const videoStats: CreativePerformance & { count: number } = { format: 'video', impressions: 0, clicks: 0, conversions: 0, spend: 0, ctr: 0, cpa: 0, cpc: 0, cpm: 0, performance_score: 0, count: 0 };
            const imageStats: CreativePerformance & { count: number } = { format: 'image', impressions: 0, clicks: 0, conversions: 0, spend: 0, ctr: 0, cpa: 0, cpc: 0, cpm: 0, performance_score: 0, count: 0 };
            const topCreatives: TopCreative[] = [];

            data?.forEach((creative: any) => {
                const isVideo = creative.detected_media_type === 'video' || !!creative.video_url;
                const stats = isVideo ? videoStats : imageStats;

                const spend = creative.spend || (creative.clicks || 0) * (creative.cpc || 0);

                stats.impressions += creative.impressions || 0;
                stats.clicks += creative.clicks || 0;
                stats.conversions += creative.conversions || 0;
                stats.spend += spend;
                stats.performance_score += auditScores.get(creative.id) || 0;
                stats.count += 1;

                topCreatives.push({
                    id: creative.id,
                    name: creative.name,
                    imageUrl: creative.image_url,
                    videoUrl: creative.video_url,
                    format: isVideo ? 'video' : 'image',
                    ctr: creative.ctr || 0,
                    conversions: creative.conversions || 0,
                    spend,
                    headline: creative.headline
                });
            });

            // Calculate aggregated metrics
            [videoStats, imageStats].forEach(stat => {
                if (stat.impressions > 0) {
                    stat.ctr = (stat.clicks / stat.impressions) * 100;
                    stat.cpm = (stat.spend / stat.impressions) * 1000;
                }
                if (stat.clicks > 0) {
                    stat.cpc = stat.spend / stat.clicks;
                }
                if (stat.conversions > 0) {
                    stat.cpa = stat.spend / stat.conversions;
                }
                if (stat.count > 0) {
                    stat.performance_score = stat.performance_score / stat.count;
                }
            });

            // Sort top creatives by conversions (or CTR if conversions are 0)
            const sortedCreatives = topCreatives
                .filter(c => c.conversions > 0)
                .sort((a, b) => b.conversions - a.conversions || b.ctr - a.ctr);

            return {
                formatBatle: {
                    video: videoStats,
                    image: imageStats
                },
                topCreatives: sortedCreatives.slice(0, 3), // Keep global top 3 with conversions
                topVideo: sortedCreatives.filter(c => c.format === 'video').slice(0, 3),
                topImage: sortedCreatives.filter(c => c.format === 'image').slice(0, 3)
            };
        },
        enabled: !!user?.company_id && !scopeLoading,
        staleTime: 2 * 60 * 1000,
    });
}
