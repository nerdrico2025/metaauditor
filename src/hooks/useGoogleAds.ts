
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GoogleCampaign {
    id: string;
    name: string;
    status: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    ctr: number;
    avg_cpc: number;
}

export interface AuctionInsight {
    domain: string;
    impression_share: number;
    overlap_rate: number;
    position_above_rate: number;
    top_of_page_rate: number;
}

export interface GeoPerformance {
    city_name: string;
    region_name: string;
    clicks: number;
    cost_micros: number;
    conversions: number;
    impressions: number;
}

export interface GoogleAd {
    id: string;
    google_id: string;
    type: string;
    status: string;
    creative_category: 'VIDEO' | 'IMAGE' | 'TEXT' | 'CAROUSEL';
    creative_elements: string[];
    headlines: string[];
}

export interface GoogleKeyword {
    id: string;
    text: string;
    match_type: string;
    status: string;
    impressions: number;
    clicks: number;
    cost_micros: number;
    conversions: number;
    avg_cpc: number;
}

export function useGoogleAds() {
    const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
        queryKey: ['google_campaigns'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('google_campaigns')
                .select('*')
                .order('spend', { ascending: false });

            if (error) throw error;
            return data as unknown as GoogleCampaign[];
        }
    });

    const { data: auctionInsights, isLoading: isLoadingInsights } = useQuery({
        queryKey: ['google_auction_insights'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('google_auction_insights')
                .select('*')
                .order('impression_share', { ascending: false });

            if (error) throw error;
            return data as unknown as AuctionInsight[];
        }
    });

    const { data: geoPerformance, isLoading: isLoadingGeo } = useQuery({
        queryKey: ['google_geo_performance'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('google_geo_performance')
                .select('*')
                .order('clicks', { ascending: false });

            if (error) throw error;
            return data as unknown as GeoPerformance[];
        }
    });

    const { data: ads, isLoading: isLoadingAds } = useQuery({
        queryKey: ['google_ads'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('google_ads')
                .select('*');
            if (error) throw error;
            return data as unknown as GoogleAd[];
        }
    });

    const { data: keywords, isLoading: isLoadingKeywords } = useQuery({
        queryKey: ['google_keywords'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('google_keywords')
                .select('*');
            if (error) throw error;
            return data as unknown as GoogleKeyword[];
        }
    });

    return {
        campaigns,
        auctionInsights,
        geoPerformance,
        ads,
        keywords,
        isLoading: isLoadingCampaigns || isLoadingInsights || isLoadingGeo || isLoadingAds || isLoadingKeywords
    };
}
