import "https://deno.land/x/postgresjs@v3.4.4/mod.js"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const { format = 'image', data = {}, otherData = {}, topCreatives = [] } = body
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

        if (!OPENAI_API_KEY) {
            throw new Error('Missing OpenAI API Key')
        }

        const safeNumber = (v: any) => isNaN(parseFloat(v)) ? 0 : parseFloat(v)

        const systemPrompt = `Você é um estrategista sênior de tráfego pago (Meta Ads & Google Ads).
    Analise os dados de performance de criativos (Vídeo vs Imagem) e forneça 3 insights curtos e acionáveis (max 1 parágrafo curto cada).
    Foque no "porquê" (ex: "Vídeo tem CTR 2x maior, indicando maior retenção").
    Use negrito **apenas** para destacar métricas ou conclusões chave.`

        const userPrompt = `
    Analise a performance do formato: ${format === 'video' ? 'VÍDEO' : 'IMAGEM'}.
    
    Dados do formato analisado:
    - CPA: R$ ${safeNumber(data.cpa).toFixed(2)}
    - CTR: ${safeNumber(data.ctr).toFixed(2)}%
    - Conversões: ${data.conversions || 0}
    - CPM: R$ ${safeNumber(data.cpm).toFixed(2)}
    
    Dados do concorrente (${format === 'video' ? 'Imagem' : 'Vídeo'}):
    - CPA: R$ ${safeNumber(otherData.cpa).toFixed(2)}
    - CTR: ${safeNumber(otherData.ctr).toFixed(2)}%
    - Conversões: ${otherData.conversions || 0}
    
    Top Criativos (Contexto):
    ${(Array.isArray(topCreatives) ? topCreatives : []).map((c: any) => `- ${c.name || 'Unnamed'} (CPA: R$ ${(safeNumber(c.spend) / (safeNumber(c.conversions) || 1)).toFixed(2)})`).join('\n')}
    
    Retorne apenas um array JSON de strings, ex: ["insight 1", "insight 2", "insight 3"]`

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
            }),
        })

        const aiData = await response.json()

        if (aiData.error) {
            console.error('OpenAI Error:', aiData.error);
            throw new Error(aiData.error.message || 'Error executing OpenAI request');
        }

        const content = aiData.choices[0].message.content

        let insights = [];
        try {
            const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            insights = JSON.parse(cleanedContent);
        } catch (e) {
            console.error('Failed to parse AI response:', content);
            insights = [content];
        }

        return new Response(JSON.stringify({ insights }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
