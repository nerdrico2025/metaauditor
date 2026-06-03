import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadCompanyAiContext, formatAiContextForPrompt } from '../_shared/ai-context.ts';
import { fetchActiveCampaignIds, ACTIVE_CAMPAIGN_STATUS_OR } from '../_shared/activeCampaignScope.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
    message: string;
    context?: 'campaigns' | 'creatives' | 'audits' | 'performance' | 'general';
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
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

        const { message, context = 'general' } = await req.json() as ChatRequest;

        if (!message) {
            throw new Error('Missing message');
        }

        // Gather context data based on request
        let contextData = '';

        if (context === 'campaigns' || context === 'general') {
            const { data: campaigns } = await supabase
                .from('campaigns')
                .select('name, status, objective, impressions, clicks, spend')
                .eq('company_id', userData.company_id)
                .or(ACTIVE_CAMPAIGN_STATUS_OR)
                .order('spend', { ascending: false })
                .limit(10);

            if (campaigns?.length) {
                contextData += '\n\nCAMPANHAS ATIVAS:\n';
                campaigns.forEach((c, i) => {
                    const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0';
                    contextData += `${i + 1}. ${c.name} (${c.status}) - Spend: R$${c.spend?.toFixed(2) || 0}, CTR: ${ctr}%\n`;
                });
            }
        }

        if (context === 'creatives' || context === 'general') {
            const activeCampaignIds = await fetchActiveCampaignIds(supabase, userData.company_id);
            const creativesQuery = supabase
                .from('creatives')
                .select('name, type, status, impressions, clicks, ctr, cpc, performance_score')
                .eq('company_id', userData.company_id)
                .order('performance_score', { ascending: false })
                .limit(10);

            if (activeCampaignIds.length > 0) {
                creativesQuery.in('campaign_id', activeCampaignIds);
            } else {
                creativesQuery.in('campaign_id', ['00000000-0000-0000-0000-000000000000']);
            }

            const { data: creatives } = await creativesQuery;

            if (creatives?.length) {
                contextData += '\n\nCRIATIVOS TOP PERFORMANCE:\n';
                creatives.forEach((c, i) => {
                    contextData += `${i + 1}. ${c.name} (${c.type}) - CTR: ${c.ctr?.toFixed(2) || 0}%, CPC: R$${c.cpc?.toFixed(2) || 0}, Score: ${c.performance_score || 0}%\n`;
                });
            }
        }

        if (context === 'audits' || context === 'general') {
            const { data: audits } = await supabase
                .from('audits')
                .select('status, compliance_score, performance_score, created_at')
                .eq('company_id', userData.company_id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (audits?.length) {
                const approved = audits.filter(a => a.status === 'approved').length;
                const rejected = audits.filter(a => a.status === 'rejected').length;
                const avgCompliance = audits.reduce((acc, a) => acc + (a.compliance_score || 0), 0) / audits.length;

                contextData += '\n\nRESUMO DE AUDITORIAS:\n';
                contextData += `Total: ${audits.length}, Aprovados: ${approved}, Rejeitados: ${rejected}\n`;
                contextData += `Média de Conformidade: ${avgCompliance.toFixed(1)}%\n`;
            }
        }

        if (context === 'performance' || context === 'general') {
            const { data: metrics } = await supabase
                .from('campaign_metrics')
                .select('impressions, clicks, spend, conversions')
                .eq('company_id', userData.company_id);

            if (metrics?.length) {
                const totals = metrics.reduce(
                    (acc, m) => ({
                        impressions: acc.impressions + (m.impressions || 0),
                        clicks: acc.clicks + (m.clicks || 0),
                        spend: acc.spend + (m.spend || 0),
                        conversions: acc.conversions + (m.conversions || 0),
                    }),
                    { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
                );

                const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(2) : '0';
                const cpc = totals.clicks > 0 ? (totals.spend / totals.clicks).toFixed(2) : '0';

                contextData += '\n\nMÉTRICAS GERAIS:\n';
                contextData += `Impressões: ${totals.impressions.toLocaleString()}\n`;
                contextData += `Cliques: ${totals.clicks.toLocaleString()}\n`;
                contextData += `CTR: ${ctr}%\n`;
                contextData += `CPC Médio: R$${cpc}\n`;
                contextData += `Spend Total: R$${totals.spend.toLocaleString()}\n`;
                contextData += `Conversões: ${totals.conversions}\n`;
            }
        }

        const aiContext = await loadCompanyAiContext(supabase, userData.company_id);
        const advertiserContext = formatAiContextForPrompt(aiContext);

        const platformGuide = `
--- SOBRE A PLATAFORMA CLICKHERO ---
Você também é assistente do ClickHero Ads Analyzer. Conheça os módulos principais:
- Dashboard: visão geral de performance e análise de branding em lote
- Campanhas / Conjuntos / Criativos: gestão e métricas das contas Meta sincronizadas
- Diagnósticos: varredura IA em lote (audit-batch) sobre criativos ativos em campanhas ativas
- Regras: verificação de branding (creative_rules) e automações de performance (automation_rules)
- Integrações: conectar conta Meta e sincronizar dados (sync-meta-data)
- Recomendações: insights estratégicos gerados por IA com base na conta
- Relatórios: exportação de performance, campanhas, criativos e auditorias

Quando o usuário perguntar como usar a plataforma, explique o módulo relevante e onde encontrá-lo no menu.
Se não houver dados sincronizados na conta, oriente a conectar a integração Meta em Integrações e rodar um sync.
`;

        const systemPrompt = `Você é um assistente de IA especializado em análise de anúncios Meta Ads (Facebook/Instagram) e no uso da plataforma ClickHero.
Você ajuda gestores de tráfego a:
- Analisar performance de campanhas e criativos
- Identificar oportunidades de otimização
- Sugerir melhorias baseadas em dados
- Explicar métricas e tendências
- Recomendar ações para melhorar resultados
- Explicar funcionalidades e fluxos da plataforma ClickHero

Responda sempre em português brasileiro, de forma clara e objetiva.
Use dados concretos da conta quando disponíveis nos blocos abaixo.
Seja proativo em sugerir ações práticas.
${platformGuide}
${advertiserContext}
${contextData ? 'DADOS DA CONTA DO USUÁRIO:' + contextData : 'Sem dados de campanha disponíveis ainda. Oriente o usuário a conectar a integração Meta e sincronizar os dados.'}`;

        const { data: recentHistory } = await supabase
            .from('ai_chat_history')
            .select('user_message, assistant_message')
            .eq('company_id', userData.company_id)
            .order('created_at', { ascending: false })
            .limit(5);

        const historyMessages: ChatMessage[] = [];
        if (recentHistory?.length) {
            for (const item of [...recentHistory].reverse()) {
                historyMessages.push({ role: 'user', content: item.user_message });
                historyMessages.push({ role: 'assistant', content: item.assistant_message });
            }
        }

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content: message },
        ];

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages,
                temperature: 0.7,
                max_tokens: 1000,
            }),
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            console.error('OpenAI error:', errorData);
            throw new Error('Failed to get AI response');
        }

        const openaiData = await openaiResponse.json();
        const assistantMessage = openaiData.choices?.[0]?.message?.content;

        if (!assistantMessage) {
            throw new Error('Empty AI response');
        }

        // Log chat interaction
        await supabase.from('ai_chat_history').insert({
            company_id: userData.company_id,
            user_id: user.id,
            user_message: message,
            assistant_message: assistantMessage,
            context,
            tokens_used: openaiData.usage?.total_tokens || 0,
        });

        return new Response(
            JSON.stringify({
                success: true,
                message: assistantMessage,
                context,
                tokens_used: openaiData.usage?.total_tokens || 0,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('AI Chat error:', error);
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
