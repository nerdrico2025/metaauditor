import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { friendlyEdgeFunctionError, parseSupabaseFunctionError } from '@/lib/edgeFunctionErrors';
import { toast } from 'sonner';

export interface RecommendationItem {
    priority: 'high' | 'medium' | 'low';
    category: 'scaling' | 'creative' | 'audience' | 'budget' | 'branding' | 'tracking';
    title: string;
    rationale: string;
    next_step: string;
}

export interface AccountSnapshot {
    label: string;
    metrics: {
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
        days: number;
        avg_ctr: number;
        avg_cpc: number;
        avg_cpa: number;
    };
    top_campaigns: Array<{ name: string; spend: number; conversions: number; cpa: number; ctr: number }>;
    creative_count: number;
    branding_compliance: { approved: number; rejected: number; pending: number };
    top_violated_rules: Array<{ rule_name: string; count: number }>;
}

export type RecommendationFocus = 'performance' | 'branding';

export interface RecommendationResponse {
    success: boolean;
    scope: 'account' | 'campaign';
    recommendation_focus: RecommendationFocus;
    snapshot: AccountSnapshot;
    recommendation: {
        headline: string;
        summary: string;
        recommendations: RecommendationItem[];
        next_review_date_iso: string;
    };
    error?: string;
}

type Args =
    | { scope: 'account'; company_id: string; recommendation_focus: RecommendationFocus }
    | { scope: 'campaign'; campaign_id: string; recommendation_focus: RecommendationFocus };

/**
 * Phase C3 (briefing #12): account- or campaign-level strategic recommendations.
 * Calls the `recommend-account` edge function.
 */
export function useAccountRecommendation() {
    return useMutation({
        mutationFn: async (args: Args): Promise<RecommendationResponse> => {
            const { data, error } = await supabase.functions.invoke('recommend-account', { body: args });
            if (error) {
                const detail = await parseSupabaseFunctionError(error, data);
                throw new Error(friendlyEdgeFunctionError(detail, 'Falha ao gerar recomendações.'));
            }
            if (!data?.success) {
                throw new Error(friendlyEdgeFunctionError(data?.error || '', 'Falha ao gerar recomendações.'));
            }
            return data as RecommendationResponse;
        },
        onError: (e: Error) => toast.error(e.message),
    });
}
