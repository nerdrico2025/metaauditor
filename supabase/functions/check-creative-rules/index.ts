import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadCompanyAiContext, formatAiContextForPrompt, formatBrandBriefingForPrompt } from '../_shared/ai-context.ts';
import { assertCreativeInActiveCampaign } from '../_shared/activeCampaignScope.ts';
import {
    buildLabeledVisionContent,
    resolveCreativeImageForAI,
    resolveUrlForAI,
    type ReferenceLogoForVision,
} from '../_shared/creativeImageForAI.ts';

const LOGO_DETECTION_GUIDANCE = `
REGRAS DE DETECÇÃO DE LOGO (aplicam-se a regras visuais que exigem logo):
- Logo PRESENTE = qualquer elemento reconhecível como logo da marca no criativo, mesmo pequeno, discreto ou com baixo contraste.
- Logo AUSENTE = não há nenhum elemento identificável como logo da marca no criativo.
- Se o logo está presente mas pequeno ou ilegível: passed=false, severity=warning, reason="Logo presente, porém pequeno/ilegível" — NUNCA diga "logo não está visível" ou "logo ausente".
- Se a regra exige posição específica (ex.: canto superior direito) e o logo está em outro lugar: falha de POSIÇÃO, não de ausência.
- Imagens de referência de logo NÃO são o criativo — nunca avalie a referência como se fosse o anúncio.
- Faça varredura sistemática nos quatro cantos antes de concluir ausência de logo.`;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
            throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your Supabase Edge Function secrets.');
        }

        // Auth
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing authorization header');

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (authError || !user) throw new Error('Unauthorized');

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();
        if (!userData?.company_id) throw new Error('User not associated with company');

        const companyId = userData.company_id;
        const { creative_id, rule_ids, force } = await req.json();
        if (!creative_id) throw new Error('Missing creative_id');

        const campaignCheck = await assertCreativeInActiveCampaign(supabase, companyId, creative_id);
        if (!campaignCheck.ok) {
            return new Response(
                JSON.stringify({ success: false, error: campaignCheck.error }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 },
            );
        }

        // Deduplication: skip if already checked in the last 6 hours (unless force=true)
        if (!force) {
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
            const { data: recentCheck } = await supabase
                .from('creative_rule_checks')
                .select('*')
                .eq('creative_id', creative_id)
                .eq('company_id', companyId)
                .gte('checked_at', sixHoursAgo)
                .order('checked_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (recentCheck) {
                return new Response(
                    JSON.stringify({ success: true, check: recentCheck, cached: true, tokens_used: 0 }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        // Fetch creative
        const { data: creative, error: creativeError } = await supabase
            .from('creatives')
            .select('*')
            .eq('id', creative_id)
            .eq('company_id', companyId)
            .single();
        if (creativeError || !creative) throw new Error('Creative not found');

        // Fetch active rules for this company (optionally filtered by rule_ids)
        let rulesQuery = supabase
            .from('creative_rules')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true);

        if (Array.isArray(rule_ids) && rule_ids.length > 0) {
            rulesQuery = rulesQuery.in('id', rule_ids);
        }

        const { data: rules, error: rulesError } = await rulesQuery;
        if (rulesError) throw rulesError;

        if (!rules || rules.length === 0) {
            const { data: check } = await supabase
                .from('creative_rule_checks')
                .insert({
                    company_id: companyId,
                    creative_id,
                    checked_at: new Date().toISOString(),
                    overall_status: 'approved',
                    overall_score: 100,
                    results: [],
                    ai_summary: 'Nenhuma regra ativa para verificar.',
                })
                .select()
                .single();

            return new Response(JSON.stringify({ success: true, check }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Filter rules that apply to this creative format
        const creativeFormat = (creative.creative_format || creative.type || 'image').toLowerCase();
        const applicableRules = rules.filter((r: any) => {
            if (r.applies_to === 'all') return true;
            return r.applies_to === creativeFormat;
        });

        if (applicableRules.length === 0) {
            const { data: check } = await supabase
                .from('creative_rule_checks')
                .insert({
                    company_id: companyId,
                    creative_id,
                    checked_at: new Date().toISOString(),
                    overall_status: 'approved',
                    overall_score: 100,
                    results: [],
                    ai_summary: 'Nenhuma regra aplicável a este formato de criativo.',
                })
                .select()
                .single();

            return new Response(JSON.stringify({ success: true, check }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Visual assets
        const imageUrl = creative.image_url || null;
        const videoUrl = creative.video_url || null;
        const hasVisualAsset = !!imageUrl;
        const hasVideo = creativeFormat === 'video' && !!videoUrl;

        // Build text context
        const videoAnalysisNote = hasVideo
            ? (hasVisualAsset
                ? 'Parcial — apenas thumbnail do vídeo disponível (vídeo fonte não pode ser analisado pela IA). Use a thumbnail para inferir presença de pessoas, texto sobreposto e qualidade visual.'
                : 'Não — criativo de vídeo sem thumbnail disponível para análise visual.')
            : hasVisualAsset
                ? 'Sim — imagem anexada para análise visual.'
                : 'Não — sem imagem ou vídeo disponível.';

        const creativeContext = `CRIATIVO:
- Nome: ${creative.name || '(sem nome)'}
- Tipo/Formato: ${creativeFormat}
- Texto principal: ${creative.text || '(vazio)'}
- Headline: ${creative.headline || '(vazio)'}
- Descrição: ${creative.description || '(vazio)'}
- CTA: ${creative.call_to_action || '(vazio)'}
- Análise visual: ${videoAnalysisNote}
- É vídeo: ${creativeFormat === 'video' ? 'Sim' : 'Não'}
- Tem vídeo fonte para análise: ${hasVideo && hasVisualAsset ? 'Não (apenas thumbnail)' : hasVideo ? 'Não' : 'N/A'}
- Status: ${creative.status}
- Impressões: ${creative.impressions || 0}
- Cliques: ${creative.clicks || 0}
- CTR: ${creative.ctr || 0}%
- CPC: R$ ${creative.cpc || 0}
- Gastos: R$ ${creative.spend || 0}`;

        const rulesPrompt = applicableRules.map((r: any, i: number) => {
            const isLogoRule = r.rule_type === 'visual' &&
                (String(r.rule_definition || '').toLowerCase().includes('logo') || !!r.logo_url);
            const logoLine = r.logo_url
                ? `- Logo de referência anexado abaixo (regra "${r.name}") — compare presença/posicionamento no criativo`
                : '';
            const logoHint = isLogoRule
                ? '\n- DETECÇÃO DE LOGO: Varredura obrigatória nos 4 cantos. Logo pequeno mas reconhecível = PRESENTE. Ausente somente se nenhum logo identificável existir.'
                : '';
            return `REGRA ${i + 1} (id: ${r.id}):
- Nome: ${r.name}
- Tipo: ${r.rule_type}
- Definição: ${r.rule_definition}
- Severidade: ${r.severity}
- Aplica-se a: ${r.applies_to}${logoLine ? `\n${logoLine}` : ''}${logoHint}`;
        }).join('\n\n');

        const aiContextLoaded = await loadCompanyAiContext(supabase, companyId);
        const brandContextBlock =
            formatBrandBriefingForPrompt(aiContextLoaded?.brand_briefing) +
            formatAiContextForPrompt(aiContextLoaded);

        const systemPrompt = `Você é um auditor especialista em criativos de anúncios (Meta Ads / Google Ads).
Sua tarefa é avaliar se um criativo CUMPRE ou NÃO CUMPRE cada regra fornecida E se está alinhado com a identidade de marca do anunciante.

IMPORTANTE:
- Analise os dados textuais E os assets visuais fornecidos (imagem, thumbnail ou vídeo).
- Quando um VÍDEO é fornecido, analise seu conteúdo completo: presença de pessoas, legendas/subtítulos, texto sobreposto, qualidade visual, cenário, e qualquer elemento relevante para as regras.
- Quando apenas a THUMBNAIL do vídeo está disponível, use-a para inferir o que for possível (presença de pessoa, clareza visual, qualidade da imagem).
- Para regras que genuinamente NÃO PODEM ser verificadas com os assets disponíveis, marque como "warning" e explique claramente.
- Considere o briefing de marca e o contexto do anunciante ao interpretar regras visuais, de copy e de conteúdo.
- Seja objetivo e prático nas avaliações.
${LOGO_DETECTION_GUIDANCE}
${brandContextBlock}
RETORNE APENAS um JSON válido neste formato:
{
  "results": [
    {
      "rule_id": "uuid-da-regra",
      "rule_name": "Nome da regra",
      "rule_type": "tipo da regra",
      "severity": "error|warning|info",
      "passed": true/false,
      "reason": "Explicação curta do motivo"
    }
  ],
  "overall_score": 0-100,
  "overall_status": "approved|warning|rejected",
  "ai_summary": "Resumo geral da verificação em 1-2 frases"
}`;

        const userPrompt = `Avalie o criativo abaixo contra as regras listadas:\n\n${creativeContext}\n\nREGRAS A VERIFICAR:\n${rulesPrompt}\n\nRetorne o JSON de avaliação.`;

        let resolvedCreativeImage = null;
        let resolvedVisual = false;
        if (hasVisualAsset) {
            resolvedCreativeImage = await resolveCreativeImageForAI(supabase, {
                imageUrl,
                externalId: creative.external_id,
                companyId,
                campaignId: creative.campaign_id,
                creativeId: creative.id,
            });

            if (!resolvedCreativeImage) {
                throw new Error(
                    'Não foi possível carregar a mídia do criativo. Tente sincronizar a conta ou aguarde o cache da imagem.',
                );
            }
            resolvedVisual = true;
        }

        const referenceLogos: ReferenceLogoForVision[] = [];
        for (const rule of applicableRules) {
            const logoUrl = rule.logo_url as string | null;
            if (!logoUrl) continue;

            const resolvedLogo = await resolveUrlForAI(logoUrl);
            if (!resolvedLogo) {
                console.warn('check-creative-rules: failed to resolve logo URL', logoUrl, 'rule', rule.name);
                continue;
            }

            referenceLogos.push({
                ruleName: rule.name,
                ruleId: rule.id,
                dataUrl: resolvedLogo.dataUrl,
            });
        }

        const userContent = buildLabeledVisionContent({
            textPrompt: userPrompt,
            creativeImage: resolvedCreativeImage,
            referenceLogos,
        });

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
                    { role: 'user', content: userContent },
                ],
                temperature: 0.3,
                max_tokens: hasVideo ? 1200 : 800,
            }),
        });

        if (!openaiResponse.ok) {
            const errData = await openaiResponse.json();
            console.error('OpenAI error:', errData);
            throw new Error(`OpenAI API error: ${errData?.error?.message || 'Unknown error'}`);
        }

        const openaiData = await openaiResponse.json();
        const content = openaiData.choices?.[0]?.message?.content;

        if (!content) throw new Error('Empty AI response');

        let aiResult;
        try {
            const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
            aiResult = JSON.parse(cleaned);
        } catch (e) {
            console.error('Failed to parse AI response:', content);
            aiResult = {
                results: applicableRules.map((r: any) => ({
                    rule_id: r.id,
                    rule_name: r.name,
                    rule_type: r.rule_type,
                    severity: r.severity,
                    passed: false,
                    reason: 'Não foi possível avaliar automaticamente (erro no parsing da IA).',
                })),
                overall_score: 50,
                overall_status: 'warning',
                ai_summary: 'A análise automática encontrou um erro ao processar a resposta da IA.',
            };
        }

        const { data: check, error: insertError } = await supabase
            .from('creative_rule_checks')
            .insert({
                company_id: companyId,
                creative_id,
                checked_at: new Date().toISOString(),
                overall_status: aiResult.overall_status || 'warning',
                overall_score: aiResult.overall_score ?? 50,
                results: aiResult.results || [],
                ai_summary: aiResult.ai_summary || '',
            })
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            throw new Error(`Failed to save check result: ${insertError.message}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                check,
                visual_analysis: resolvedVisual,
                tokens_used: openaiData.usage?.total_tokens || 0,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('check-creative-rules error:', error);
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
