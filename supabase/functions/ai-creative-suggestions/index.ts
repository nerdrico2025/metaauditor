import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadCompanyAiContext, formatAiContextForPrompt } from '../_shared/ai-context.ts';
import { fetchActiveCampaignIds, assertCreativeInActiveCampaign } from '../_shared/activeCampaignScope.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SuggestionRequest {
    creative_id?: string;
    campaign_id?: string;
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

        if (!openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (authError || !user) {
            throw new Error('Unauthorized');
        }

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!userData?.company_id) {
            throw new Error('User not associated with company');
        }

        const { creative_id, campaign_id } = await req.json() as SuggestionRequest;

        // Get context data
        let creativeContext = '';
        let campaignContext = '';

        if (creative_id) {
            const campaignCheck = await assertCreativeInActiveCampaign(
                supabase,
                userData.company_id,
                creative_id,
            );
            if (!campaignCheck.ok) {
                return new Response(
                    JSON.stringify({ success: false, error: campaignCheck.error }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 },
                );
            }

            const { data: creative } = await supabase
                .from('creatives')
                .select('*')
                .eq('id', creative_id)
                .single();

            if (creative) {
                creativeContext = `
CRIATIVO ATUAL:
Nome: ${creative.name}
Tipo: ${creative.type}
Headline: ${creative.headline || 'N/A'}
Texto: ${creative.text || 'N/A'}
CTA: ${creative.call_to_action || 'N/A'}
CTR: ${creative.ctr?.toFixed(2) || 0}%
CPC: R$${creative.cpc?.toFixed(2) || 0}
Score: ${creative.performance_score || 0}%
`;
            }
        }

        // Get top performing creatives for reference
        const activeCampaignIds = await fetchActiveCampaignIds(supabase, userData.company_id);
        const topCreativesQuery = supabase
            .from('creatives')
            .select('name, type, headline, text, call_to_action, ctr, cpc, performance_score')
            .eq('company_id', userData.company_id)
            .order('performance_score', { ascending: false })
            .limit(5);

        if (activeCampaignIds.length > 0) {
            topCreativesQuery.in('campaign_id', activeCampaignIds);
        } else {
            topCreativesQuery.in('campaign_id', ['00000000-0000-0000-0000-000000000000']);
        }

        const { data: topCreatives } = await topCreativesQuery;

        if (topCreatives?.length) {
            campaignContext = '\nTOP 5 CRIATIVOS DE MELHOR PERFORMANCE:\n';
            topCreatives.forEach((c, i) => {
                campaignContext += `${i + 1}. ${c.name} (CTR: ${c.ctr?.toFixed(2) || 0}%, Score: ${c.performance_score || 0}%)\n`;
                if (c.headline) campaignContext += `   Headline: ${c.headline}\n`;
                if (c.text) campaignContext += `   Texto: ${c.text.substring(0, 100)}...\n`;
            });
        }

        // Get campaign info if provided
        if (campaign_id) {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('name, objective, status')
                .eq('id', campaign_id)
                .single();

            if (campaign) {
                campaignContext += `\nCAMPANHA: ${campaign.name}\nOBJETIVO: ${campaign.objective || 'N/A'}\n`;
            }
        }

        const systemPrompt = `Você é um especialista em criação de anúncios para Meta Ads (Facebook/Instagram).
Baseado nos dados dos criativos, gere sugestões práticas e específicas para melhorar a performance.

Responda em JSON com a seguinte estrutura:
{
  "headline_suggestions": ["sugestão 1", "sugestão 2", "sugestão 3"],
  "body_text_suggestions": ["sugestão 1", "sugestão 2"],
  "cta_suggestions": ["CTA 1", "CTA 2"],
  "visual_recommendations": ["recomendação 1", "recomendação 2"],
  "a_b_test_ideas": ["ideia de teste 1", "ideia de teste 2"],
  "optimization_tips": ["dica 1", "dica 2", "dica 3"]
}

Seja específico e prático. Use insights dos melhores criativos como inspiração.`;

        const aiContext = await loadCompanyAiContext(supabase, userData.company_id);
        const advertiserContext = formatAiContextForPrompt(aiContext);

        const userPrompt = `Gere sugestões de novos criativos e otimizações baseado nestes dados:
${advertiserContext}
${creativeContext}
${campaignContext}

Foque em:
1. Headlines que chamem atenção
2. Textos persuasivos e diretos
3. CTAs efetivos
4. Elementos visuais que convertem
5. Ideias para testes A/B`;

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.8,
                max_tokens: 1500,
            }),
        });

        if (!openaiResponse.ok) {
            throw new Error('Failed to get AI suggestions');
        }

        const openaiData = await openaiResponse.json();
        const content = openaiData.choices?.[0]?.message?.content;

        let suggestions;
        try {
            suggestions = JSON.parse(content);
        } catch {
            // If not valid JSON, return raw content
            suggestions = { raw_suggestions: content };
        }

        // Save suggestions to database
        await supabase.from('ai_suggestions').insert({
            company_id: userData.company_id,
            creative_id: creative_id || null,
            campaign_id: campaign_id || null,
            suggestions,
            tokens_used: openaiData.usage?.total_tokens || 0,
        });

        return new Response(
            JSON.stringify({
                success: true,
                suggestions,
                tokens_used: openaiData.usage?.total_tokens || 0,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('AI suggestions error:', error);
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
