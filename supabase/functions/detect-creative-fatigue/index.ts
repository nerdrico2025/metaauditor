import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchActiveCampaignIds } from '../_shared/activeCampaignScope.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreativeFatigueResult {
    creative_id: string;
    creative_name: string;
    fatigue_level: 'low' | 'medium' | 'high' | 'critical';
    decline_percentage: number;
    days_active: number;
    recommendation: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // This function can be called via CRON or manually
        // Get all companies with active integrations
        const { data: integrations } = await supabase
            .from('integrations')
            .select('company_id')
            .eq('status', 'active')
            .eq('platform', 'meta_ads');

        if (!integrations?.length) {
            return new Response(
                JSON.stringify({ success: true, message: 'No active integrations' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const allResults: { company_id: string; fatigued_creatives: CreativeFatigueResult[] }[] = [];

        for (const integration of integrations) {
            const companyId = integration.company_id;

            // Get creatives with their metrics over time
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const activeCampaignIds = await fetchActiveCampaignIds(supabase, companyId);
            if (activeCampaignIds.length === 0) continue;

            const { data: creatives } = await supabase
                .from('creatives')
                .select('id, name, created_at, impressions, clicks, ctr')
                .eq('company_id', companyId)
                .eq('status', 'active')
                .in('campaign_id', activeCampaignIds)
                .gt('impressions', 1000);

            if (!creatives?.length) continue;

            // Get historical metrics for comparison
            const { data: recentMetrics } = await supabase
                .from('creative_metrics')
                .select('creative_id, date, impressions, clicks, ctr')
                .eq('company_id', companyId)
                .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
                .order('date', { ascending: true });

            const fatiguedCreatives: CreativeFatigueResult[] = [];

            for (const creative of creatives) {
                const creativeMetrics = recentMetrics?.filter(m => m.creative_id === creative.id) || [];

                if (creativeMetrics.length < 7) continue; // Need at least a week of data

                // Calculate CTR trend
                const firstWeekMetrics = creativeMetrics.slice(0, 7);
                const lastWeekMetrics = creativeMetrics.slice(-7);

                const avgFirstWeekCtr = firstWeekMetrics.reduce((acc, m) => acc + (m.ctr || 0), 0) / firstWeekMetrics.length;
                const avgLastWeekCtr = lastWeekMetrics.reduce((acc, m) => acc + (m.ctr || 0), 0) / lastWeekMetrics.length;

                if (avgFirstWeekCtr === 0) continue;

                const declinePercentage = ((avgFirstWeekCtr - avgLastWeekCtr) / avgFirstWeekCtr) * 100;
                const daysActive = Math.floor((Date.now() - new Date(creative.created_at).getTime()) / (1000 * 60 * 60 * 24));

                // Determine fatigue level
                let fatigueLevel: 'low' | 'medium' | 'high' | 'critical';
                let recommendation: string;

                if (declinePercentage >= 50) {
                    fatigueLevel = 'critical';
                    recommendation = 'Pausar imediatamente e substituir por novo criativo';
                } else if (declinePercentage >= 30) {
                    fatigueLevel = 'high';
                    recommendation = 'Preparar novo criativo para substituição em breve';
                } else if (declinePercentage >= 15) {
                    fatigueLevel = 'medium';
                    recommendation = 'Monitorar de perto e testar variações';
                } else {
                    fatigueLevel = 'low';
                    recommendation = 'Performance estável, continuar monitorando';
                }

                if (fatigueLevel !== 'low') {
                    fatiguedCreatives.push({
                        creative_id: creative.id,
                        creative_name: creative.name,
                        fatigue_level: fatigueLevel,
                        decline_percentage: Math.round(declinePercentage),
                        days_active: daysActive,
                        recommendation,
                    });

                    // Create notification for high/critical fatigue
                    if (fatigueLevel === 'high' || fatigueLevel === 'critical') {
                        await supabase.from('notifications').insert({
                            company_id: companyId,
                            type: 'creative_fatigue',
                            title: `Fadiga de Criativo: ${creative.name}`,
                            message: recommendation,
                            priority: fatigueLevel === 'critical' ? 'high' : 'medium',
                            metadata: {
                                creative_id: creative.id,
                                fatigue_level: fatigueLevel,
                                decline_percentage: Math.round(declinePercentage),
                            },
                        });
                    }
                }
            }

            if (fatiguedCreatives.length > 0) {
                allResults.push({
                    company_id: companyId,
                    fatigued_creatives: fatiguedCreatives,
                });
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                companies_analyzed: integrations.length,
                results: allResults,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('Creative fatigue detection error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: String(error),
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
