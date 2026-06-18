import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadCompanyAiContext, formatAiContextForPrompt } from '../_shared/ai-context.ts';
import {
    aggregateCampaignMetrics,
    buildEntityPerformanceRulesReport,
    computeEntityPerformanceScore,
    fetchActiveChildCreatives,
    fetchActivePerformanceRules,
    formatCreativesBlock,
    formatMetricsBlock,
    formatRulesBlock,
    getCampaignExpertPrompt,
} from '../_shared/entity-audit.ts';
import { persistRecommendations } from '../_shared/persist-recommendations.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditRequest {
    campaign_id: string;
    date_start?: string;
    date_end?: string;
    force_refresh?: boolean;
    performance_rule_ids?: string[];
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing authorization header');

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', ''),
        );
        if (authError || !user) throw new Error('Unauthorized');

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();
        if (!userData?.company_id) throw new Error('User not associated with company');

        const { campaign_id, date_start, date_end, force_refresh, performance_rule_ids } = await req.json() as AuditRequest;
        if (!campaign_id) throw new Error('Missing campaign_id');

        const auditFocus = 'performance';

        const { data: campaign, error: campError } = await supabase
            .from('campaigns')
            .select('id, name, objective, status, daily_budget, lifetime_budget, company_id, ad_sets(id)')
            .eq('id', campaign_id)
            .eq('company_id', userData.company_id)
            .single();

        if (campError || !campaign) throw new Error('Campaign not found');

        const [metrics, childCreatives, perfRules] = await Promise.all([
            aggregateCampaignMetrics(supabase, campaign_id, date_start, date_end),
            fetchActiveChildCreatives(supabase, { campaignId: campaign_id }),
            fetchActivePerformanceRules(
                supabase,
                userData.company_id,
                Array.isArray(performance_rule_ids) && performance_rule_ids.length > 0
                    ? performance_rule_ids
                    : undefined,
            ),
        ]);

        const rulesReport = buildEntityPerformanceRulesReport(perfRules, metrics, childCreatives);

        let aiAnalysis: Record<string, unknown> | null = null;
        let aiScore: number | null = null;

        if (openaiApiKey) {
            const aiContext = await loadCompanyAiContext(supabase, userData.company_id);
            const advertiserContext = formatAiContextForPrompt(aiContext);

            const prompt = `${advertiserContext}

--- CAMPANHA ---
Nome: ${campaign.name}
Objetivo: ${campaign.objective || 'N/A'}
Status: ${campaign.status}
Orçamento: ${campaign.daily_budget ? `Diário R$ ${campaign.daily_budget}` : campaign.lifetime_budget ? `Vitalício R$ ${campaign.lifetime_budget}` : 'N/A'}
Conjuntos ativos: ${campaign.ad_sets?.length ?? 0}
Criativos ativos: ${childCreatives.length}

${formatMetricsBlock(metrics, '--- MÉTRICAS AGREGADAS (período selecionado) ---')}

--- REGRAS DE PERFORMANCE (nível campanha — totais agregados) ---
${formatRulesBlock(rulesReport)}

--- DISTRIBUIÇÃO DE CRIATIVOS ---
${formatCreativesBlock(childCreatives)}`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: getCampaignExpertPrompt() },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.5,
                    max_tokens: 2000,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) {
                    try {
                        aiAnalysis = JSON.parse(content);
                        aiScore = Number(aiAnalysis.overall_score) || null;
                        if (aiAnalysis.score_breakdown && typeof aiAnalysis.score_breakdown === 'object') {
                            (aiAnalysis.score_breakdown as Record<string, unknown>).performance_rules_pass_rate =
                                rulesReport.pass_rate;
                            (aiAnalysis.score_breakdown as Record<string, unknown>).audit_focus = auditFocus;
                        }
                        aiAnalysis.performance_rules_compliance = rulesReport.aggregated;
                        aiAnalysis.performance_rules_rollup = rulesReport.rollup;
                        aiAnalysis.audit_focus = auditFocus;
                    } catch (e) {
                        console.error('JSON parse error', e);
                    }
                }
            }
        }

        const performanceScore = computeEntityPerformanceScore(
            aiScore,
            rulesReport.pass_rate,
            perfRules.length > 0,
        );

        const issues = [
            ...(aiAnalysis?.weaknesses as string[] | undefined)?.map((w: string) => ({
                type: 'performance' as const,
                severity: 'warning' as const,
                message: w,
            })) ?? [],
            ...rulesReport.aggregated
                .filter((r) => !r.passed)
                .map((r) => ({
                    type: 'performance' as const,
                    severity: 'error' as const,
                    message: r.reason,
                })),
        ];

        const recommendations = (aiAnalysis?.action_plan as string[] | undefined) ?? [];

        const { data: audit, error: auditError } = await supabase
            .from('audits')
            .insert({
                company_id: userData.company_id,
                campaign_id,
                creative_id: null,
                ad_set_id: null,
                audit_level: 'campaign',
                audit_focus: auditFocus,
                status: 'completed',
                compliance_score: performanceScore,
                performance_score: performanceScore,
                ai_analysis: aiAnalysis,
                issues,
                recommendations,
            })
            .select()
            .single();

        if (auditError) throw auditError;

        try {
            const recItems = (recommendations as string[]).slice(0, 5).map((title, i) => ({
                company_id: userData.company_id,
                source_type: 'campaign_analysis' as const,
                campaign_id,
                audit_id: audit.id,
                priority: (i === 0 ? 'high' : 'medium') as 'high' | 'medium',
                category: 'performance' as const,
                title: title.slice(0, 120),
                rationale: (aiAnalysis?.executive_summary as string) || 'Diagnóstico de performance da campanha.',
                next_step: title,
            }));
            if (recItems.length) await persistRecommendations(supabase, recItems);
        } catch (e) {
            console.error('Recommendations persist error', e);
        }

        return new Response(JSON.stringify({ success: true, audit, cached: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: String(error) }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
