import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadCompanyAiContext, formatAiContextForPrompt } from '../_shared/ai-context.ts';
import { evaluatePerformanceRules, perfRulesPassRate } from '../_shared/performance-eval.ts';
import { buildCreativeAuditRecommendations, persistRecommendations } from '../_shared/persist-recommendations.ts';
import { assertCreativeInActiveCampaign } from '../_shared/activeCampaignScope.ts';
import {
    type AuditFocus,
    getExpertPrompt,
    getVisualPrompt,
} from './prompts.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditRequest {
    creative_id: string;
    policy_id?: string;
    rule_ids?: string[];
    force_refresh?: boolean;
    audit_focus?: AuditFocus;
    analysis_mode?: 'fast' | 'balanced' | 'full';
}

interface AuditIssue {
    type: 'keyword' | 'text_length' | 'brand' | 'performance' | 'persuasion' | 'visual' | 'cta' | 'compliance';
    severity: 'error' | 'warning' | 'info';
    message: string;
    details?: Record<string, unknown>;
}

function resolveAuditFocus(raw?: string): AuditFocus {
    return raw === 'branding' ? 'branding' : 'performance';
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
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', ''),
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

        const {
            creative_id,
            policy_id,
            rule_ids,
            force_refresh,
            audit_focus: rawFocus,
            analysis_mode = 'balanced',
        } =
            await req.json() as AuditRequest;

        if (!creative_id) {
            throw new Error('Missing creative_id');
        }

        const auditFocus = resolveAuditFocus(rawFocus);
        const isBranding = auditFocus === 'branding';

        // Deduplication per creative + focus (6h unless force_refresh)
        if (!force_refresh) {
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
            const { data: recentAudit } = await supabase
                .from('audits')
                .select('id, status, compliance_score, performance_score, audit_focus, ai_analysis, issues, recommendations, created_at')
                .eq('creative_id', creative_id)
                .eq('company_id', userData.company_id)
                .eq('audit_focus', auditFocus)
                .gte('created_at', sixHoursAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (recentAudit) {
                return new Response(
                    JSON.stringify({
                        success: true,
                        audit_id: recentAudit.id,
                        audit_focus: auditFocus,
                        status: recentAudit.status,
                        compliance_score: recentAudit.compliance_score,
                        performance_score: recentAudit.performance_score,
                        issues_count: recentAudit.issues?.length || 0,
                        has_ai_analysis: !!recentAudit.ai_analysis,
                        cached: true,
                    }),
                    {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200,
                    },
                );
            }
        }

        const campaignCheck = await assertCreativeInActiveCampaign(
            supabase,
            userData.company_id,
            creative_id,
        );
        if (!campaignCheck.ok) {
            return new Response(
                JSON.stringify({ success: false, error: campaignCheck.error }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 422,
                },
            );
        }

        const { data: creative, error: creativeError } = await supabase
            .from('creatives')
            .select('*')
            .eq('id', creative_id)
            .eq('company_id', userData.company_id)
            .single();

        if (creativeError || !creative) {
            throw new Error('Creative not found');
        }

        let policy;
        if (policy_id) {
            const { data } = await supabase
                .from('policies')
                .select('*')
                .eq('id', policy_id)
                .single();
            policy = data;
        } else {
            const { data } = await supabase
                .from('policies')
                .select('*')
                .eq('company_id', userData.company_id)
                .eq('is_default', true)
                .single();
            policy = data;
        }

        const issues: AuditIssue[] = [];
        const recommendations: string[] = [];
        let complianceScore = 100;
        let performanceScore = 100;

        // Creative rules — branding focus only (or legacy rule_ids on performance)
        let creativeRules: Array<Record<string, unknown>> = [];
        if (isBranding || (Array.isArray(rule_ids) && rule_ids.length > 0)) {
            let creativeRulesQuery = supabase
                .from('creative_rules')
                .select('*')
                .eq('company_id', userData.company_id)
                .eq('is_active', true);

            if (Array.isArray(rule_ids) && rule_ids.length > 0) {
                creativeRulesQuery = creativeRulesQuery.in('id', rule_ids);
            }

            const { data: creativeRulesRaw } = await creativeRulesQuery;
            creativeRules = creativeRulesRaw ?? [];
        }

        // Performance rules — performance focus only
        let perfCompliance: Array<{ rule_name: string; passed: boolean; reason: string }> = [];
        let perfPassRate = 100;

        if (!isBranding) {
            const { data: automationRules } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('company_id', userData.company_id)
                .eq('status', 'active');

            perfCompliance = evaluatePerformanceRules(automationRules ?? [], creative);
            perfPassRate = perfRulesPassRate(perfCompliance);

            for (const pr of perfCompliance.filter(r => !r.passed)) {
                issues.push({
                    type: 'performance',
                    severity: 'warning',
                    message: pr.reason,
                    details: { rule_name: pr.rule_name },
                });
                performanceScore -= 10;
            }
        }

        const creativeText = [creative.text, creative.headline, creative.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        if (policy) {
            if (isBranding) {
                if (policy.prohibited_keywords?.length) {
                    for (const keyword of policy.prohibited_keywords) {
                        if (creativeText.includes(keyword.toLowerCase())) {
                            issues.push({
                                type: 'keyword',
                                severity: 'error',
                                message: `Palavra proibida encontrada: "${keyword}"`,
                                details: { keyword },
                            });
                            complianceScore -= 15;
                        }
                    }
                }

                if (policy.required_keywords?.length) {
                    for (const keyword of policy.required_keywords) {
                        if (!creativeText.includes(keyword.toLowerCase())) {
                            issues.push({
                                type: 'keyword',
                                severity: 'warning',
                                message: `Palavra obrigatória ausente: "${keyword}"`,
                                details: { keyword },
                            });
                            complianceScore -= 5;
                        }
                    }
                }

                const textLength = creativeText.length;
                if (policy.min_text_length && textLength < policy.min_text_length) {
                    issues.push({
                        type: 'text_length',
                        severity: 'warning',
                        message: `Texto muito curto (${textLength} caracteres, mínimo: ${policy.min_text_length})`,
                        details: { current: textLength, min: policy.min_text_length },
                    });
                    complianceScore -= 10;
                }

                if (policy.max_text_length && textLength > policy.max_text_length) {
                    issues.push({
                        type: 'text_length',
                        severity: 'warning',
                        message: `Texto muito longo (${textLength} caracteres, máximo: ${policy.max_text_length})`,
                        details: { current: textLength, max: policy.max_text_length },
                    });
                    complianceScore -= 10;
                }
            } else {
                // Performance: only prohibited keywords (delivery risk) + metric thresholds
                if (policy.prohibited_keywords?.length) {
                    for (const keyword of policy.prohibited_keywords) {
                        if (creativeText.includes(keyword.toLowerCase())) {
                            issues.push({
                                type: 'keyword',
                                severity: 'error',
                                message: `Palavra proibida (risco de entrega): "${keyword}"`,
                                details: { keyword },
                            });
                            complianceScore -= 10;
                        }
                    }
                }

                const ctr = Number(creative.ctr) || 0;
                const cpc = Number(creative.cpc) || 0;

                if (policy.ctr_min && ctr > 0 && ctr < policy.ctr_min) {
                    issues.push({
                        type: 'performance',
                        severity: 'warning',
                        message: `CTR abaixo do mínimo (${ctr.toFixed(2)}% < ${policy.ctr_min}%)`,
                        details: { current: ctr, min: policy.ctr_min },
                    });
                    performanceScore -= 15;
                    recommendations.push('Considere testar novas variações de copy para melhorar o CTR');
                }

                if (policy.cpc_max && cpc > 0 && cpc > policy.cpc_max) {
                    issues.push({
                        type: 'performance',
                        severity: 'warning',
                        message: `CPC acima do máximo (R$${cpc.toFixed(2)} > R$${policy.cpc_max})`,
                        details: { current: cpc, max: policy.cpc_max },
                    });
                    performanceScore -= 15;
                    recommendations.push('Revise a segmentação e o lance para reduzir o CPC');
                }
            }
        }

        let aiAnalysis: Record<string, unknown> | null = null;

        const aiContext = [creative.text, creative.headline, creative.description, creative.name]
            .filter(Boolean)
            .join(' ');

        const hasVideoAsset = creative.video_url &&
            (creative.creative_format || creative.type || '').toLowerCase() === 'video';
        const hasImageAsset = !!creative.image_url;
        const hasVisualForAI = hasVideoAsset || hasImageAsset;
        const hasStrongText = (creative.text?.length || 0) > 40 || (creative.headline?.length || 0) > 20;
        const shouldAnalyzeVisual = analysis_mode === 'full'
            || (analysis_mode === 'balanced' && hasVisualForAI && (!hasStrongText || isBranding))
            || (analysis_mode !== 'fast' && hasVisualForAI && !!rule_ids?.length);
        const hasAnyCreativeSignal = hasVisualForAI || aiContext.length > 3;

        // Short-circuit low-signal creatives to reduce latency/cost on large batches.
        if (!hasAnyCreativeSignal) {
            aiAnalysis = {
                error: 'insufficient_signal',
                executive_summary: 'Criativo sem sinal suficiente (texto e visual). Aplicado diagnóstico determinístico rápido.',
                suggestions: [
                    'Adicione texto principal e headline mais claros.',
                    'Inclua imagem ou vídeo principal no criativo.',
                    'Defina CTA explícito e reexecute a auditoria.',
                ],
                action_plan: [
                    'Completar copy básica do anúncio.',
                    'Adicionar asset visual principal.',
                    'Rodar nova auditoria após preencher os dados.',
                ],
            };
        }

        if (!aiAnalysis && openaiApiKey && (aiContext.length > 3 || hasVisualForAI)) {
            try {
                let visualDescription = '';
                if (shouldAnalyzeVisual) {
                    try {
                        const visualContent: Array<Record<string, unknown>> = [
                            { type: 'text', text: 'Analise detalhadamente este criativo de anúncio:' },
                        ];

                        if (hasImageAsset) {
                            visualContent.push({
                                type: 'image_url',
                                image_url: { url: creative.image_url, detail: 'high' },
                            });
                        }
                        if (hasVideoAsset && creative.video_url !== creative.image_url) {
                            visualContent.push({
                                type: 'image_url',
                                image_url: { url: creative.video_url, detail: 'high' },
                            });
                        }

                        const visualResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${openaiApiKey}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                model: 'gpt-4o-mini',
                                messages: [
                                    { role: 'system', content: getVisualPrompt(auditFocus) },
                                    { role: 'user', content: visualContent },
                                ],
                                temperature: 0.3,
                                max_tokens: 500,
                            }),
                        });

                        if (visualResponse.ok) {
                            const vData = await visualResponse.json();
                            visualDescription = vData.choices?.[0]?.message?.content || '';
                        }
                    } catch (e) {
                        console.error('Visual analysis agent error:', e);
                    }
                }

                const ctr = Number(creative.ctr) || 0;
                const cpc = Number(creative.cpc) || 0;
                const spend = Number(creative.spend) || 0;
                const impressions = Number(creative.impressions) || 0;
                const clicks = Number(creative.clicks) || 0;

                let performanceContext = '';
                if (!isBranding && (spend > 0 || ctr > 0 || impressions > 0)) {
                    performanceContext = `\n\n--- MÉTRICAS DE PERFORMANCE ---
Investimento: R$${spend.toFixed(2)}
Impressões: ${impressions.toLocaleString('pt-BR')}
Cliques: ${clicks.toLocaleString('pt-BR')}
CTR: ${ctr.toFixed(2)}%
CPC: R$${cpc.toFixed(2)}`;
                }

                let rulesContext = '';
                if (isBranding && creativeRules.length) {
                    rulesContext = '\n\n--- REGRAS DE BRANDING DO ANUNCIANTE ---\nVerifique se o criativo cumpre estas regras:\n';
                    for (const rule of creativeRules) {
                        const formatFilter = rule.applies_to !== 'all'
                            ? ` [Aplica-se a: ${rule.applies_to}]`
                            : '';
                        rulesContext += `- [${String(rule.severity).toUpperCase()}] ${rule.name}: ${rule.rule_definition}${formatFilter}\n`;
                    }
                    rulesContext += '\nPara cada regra, indique CUMPRE ou VIOLA no campo "rules_compliance".';
                }

                if (!isBranding && perfCompliance.length > 0) {
                    rulesContext += '\n\n--- REGRAS DE PERFORMANCE (MÉTRICAS) ---\n';
                    for (const pr of perfCompliance) {
                        rulesContext += `- ${pr.rule_name}: ${pr.passed ? 'OK' : 'VIOLADA'} — ${pr.reason}\n`;
                    }
                }

                const creativeFormat = (creative.creative_format || creative.type || 'image').toLowerCase();
                const aiContextLoaded = await loadCompanyAiContext(supabase, userData.company_id);
                const advertiserContext = formatAiContextForPrompt(aiContextLoaded);
                const contextWarning = !aiContextLoaded
                    ? '\n\nAVISO: Contexto do anunciante não configurado — recomendações serão mais genéricas.'
                    : '';

                const focusLabel = isBranding ? 'BRANDING / CONFORMIDADE DE MARCA' : 'PERFORMANCE / CONVERSÃO E ESCALA';

                const userMessage = `Análise com foco: ${focusLabel}
${advertiserContext}
--- DADOS DO CRIATIVO ---
Nome: ${creative.name || '(Sem nome)'}
Tipo: ${creativeFormat}
Texto Principal: ${creative.text || '(Vazio — PENALIZE na avaliação)'}
Headline: ${creative.headline || '(Vazio)'}
Descrição: ${creative.description || '(Vazio)'}
CTA Configurado: ${creative.call_to_action || '(Nenhum — PENALIZE na avaliação)'}
Status: ${creative.status || 'unknown'}
${performanceContext}
${visualDescription ? `\n--- ANÁLISE VISUAL DO AGENTE DE VISÃO ---\n${visualDescription}` : '(Análise visual pulada para otimizar latência no lote)'}
${rulesContext}
${contextWarning}

IMPORTANTE: Analise com RIGOR no foco ${focusLabel}. Scores devem refletir a REALIDADE do criativo.${
                    isBranding && creativeRules.length
                        ? '\n\nAdicione "rules_compliance": [{"rule_name": "...", "passed": boolean, "reason": "..."}] para cada regra de branding listada.'
                        : ''
                }`;

                const mainResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openaiApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        response_format: { type: 'json_object' },
                        messages: [
                            { role: 'system', content: getExpertPrompt(auditFocus) },
                            { role: 'user', content: userMessage },
                        ],
                        temperature: 0.4,
                        max_tokens: 2000,
                    }),
                });

                if (mainResponse.ok) {
                    const mainData = await mainResponse.json();
                    const content = mainData.choices?.[0]?.message?.content;
                    if (content) {
                        try {
                            const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
                            aiAnalysis = JSON.parse(cleaned);

                            const actionPlan = aiAnalysis.action_plan as string[] | undefined;
                            const suggestions = aiAnalysis.suggestions as string[] | undefined;
                            if (actionPlan?.length) {
                                recommendations.push(...actionPlan.slice(0, 5));
                            } else if (suggestions?.length) {
                                recommendations.push(...suggestions.slice(0, 5));
                            }
                        } catch {
                            const jsonMatch = content.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                try {
                                    aiAnalysis = JSON.parse(jsonMatch[0]);
                                    const ap = aiAnalysis?.action_plan as string[] | undefined;
                                    if (ap?.length) recommendations.push(...ap.slice(0, 5));
                                } catch {
                                    aiAnalysis = { error: 'parse_failed', raw_preview: content.slice(0, 500) };
                                }
                            } else {
                                aiAnalysis = { error: 'parse_failed', raw_preview: content.slice(0, 500) };
                            }
                        }
                    }
                } else {
                    aiAnalysis = { error: 'api_failed', status: mainResponse.status };
                }
            } catch (error) {
                console.error('AI analysis error:', error);
                aiAnalysis = { error: 'exception', message: String(error) };
            }
        }

        const aiParseFailed = !!aiAnalysis?.error;
        const aiOverallScore = typeof aiAnalysis?.overall_score === 'number' ? aiAnalysis.overall_score : null;

        const policyCompliance = Math.max(0, Math.min(100, complianceScore));
        performanceScore = Math.max(0, Math.min(100, performanceScore));

        const creativeRulesPassRate = (() => {
            const rc = aiAnalysis?.rules_compliance as Array<{ passed: boolean }> | undefined;
            if (rc?.length) {
                const passed = rc.filter(r => r.passed).length;
                return Math.round((passed / rc.length) * 100);
            }
            return creativeRules.length > 0 ? 100 : 100;
        })();

        const scoreBreakdown = {
            ai_overall: aiOverallScore,
            policy_compliance: policyCompliance,
            performance_metrics: performanceScore,
            performance_rules_pass_rate: isBranding ? null : perfPassRate,
            creative_rules_pass_rate: isBranding ? creativeRulesPassRate : null,
            audit_focus: auditFocus,
        };

        let unifiedScore: number;
        let finalComplianceScore: number;
        let finalPerformanceScore: number;

        if (isBranding) {
            unifiedScore = aiOverallScore != null
                ? Math.round(aiOverallScore * 0.3 + policyCompliance * 0.3 + creativeRulesPassRate * 0.4)
                : Math.round(policyCompliance * 0.4 + creativeRulesPassRate * 0.6);
            finalComplianceScore = unifiedScore;
            const visualSub = typeof aiAnalysis?.visual_score === 'number' ? aiAnalysis.visual_score : unifiedScore;
            finalPerformanceScore = Math.round(visualSub);
        } else {
            unifiedScore = aiOverallScore != null
                ? Math.round(aiOverallScore * 0.4 + performanceScore * 0.25 + perfPassRate * 0.35)
                : Math.round(performanceScore * 0.35 + perfPassRate * 0.65);
            finalPerformanceScore = unifiedScore;
            finalComplianceScore = policyCompliance;
        }

        if (aiParseFailed && aiAnalysis && typeof aiAnalysis === 'object' && !Array.isArray(aiAnalysis)) {
            const deterministicStrengths: string[] = [];
            const deterministicWeaknesses: string[] = [];

            if (isBranding) {
                if (policyCompliance >= 90 && !issues.some(i => i.severity === 'error')) {
                    deterministicStrengths.push('Política de compliance atendida nos checks determinísticos.');
                }
                for (const issue of issues) {
                    deterministicWeaknesses.push(issue.message);
                }
            } else {
                for (const pr of perfCompliance.filter(r => r.passed)) {
                    deterministicStrengths.push(`${pr.rule_name}: ${pr.reason}`);
                }
                if (policyCompliance >= 90 && !issues.some(i => i.severity === 'error')) {
                    deterministicStrengths.push('Checks de política básicos OK.');
                }
                for (const issue of issues) {
                    deterministicWeaknesses.push(issue.message);
                }
                for (const pr of perfCompliance.filter(r => !r.passed)) {
                    deterministicWeaknesses.push(`${pr.rule_name}: ${pr.reason}`);
                }
            }

            const focusLabel = isBranding ? 'branding' : 'performance';
            const fallbackSummary =
                `Análise concluída com base nas regras e políticas configuradas. Score de ${focusLabel}: ${unifiedScore}%.` +
                (isBranding
                    ? ` Política ${policyCompliance}%, regras de branding ${creativeRulesPassRate}%.`
                    : ` Métricas ${performanceScore}%, regras de performance ${perfPassRate}%.`);

            const stubPatch: Record<string, unknown> = {
                ...aiAnalysis,
                strengths: [...((aiAnalysis.strengths as string[]) ?? []), ...deterministicStrengths],
                weaknesses: [...((aiAnalysis.weaknesses as string[]) ?? []), ...deterministicWeaknesses],
                suggestions: aiAnalysis.suggestions ?? aiAnalysis.action_plan ?? recommendations.slice(0, 5),
                executive_summary: aiAnalysis.executive_summary ?? aiAnalysis.tone_analysis ?? fallbackSummary,
            };

            if (isBranding) {
                stubPatch.rules_compliance = aiAnalysis.rules_compliance ?? [];
            } else {
                stubPatch.performance_rules_compliance = perfCompliance;
            }

            aiAnalysis = stubPatch;
        }

        if (aiAnalysis && typeof aiAnalysis === 'object' && !Array.isArray(aiAnalysis)) {
            aiAnalysis = {
                ...aiAnalysis,
                audit_focus: auditFocus,
                score_breakdown: scoreBreakdown,
                performance_rules_compliance: isBranding ? [] : perfCompliance,
                executive_summary: aiAnalysis.executive_summary || aiAnalysis.tone_analysis || null,
            };
        }

        const hasErrors = issues.some(i => i.severity === 'error');
        const status = aiParseFailed
            ? 'pending'
            : hasErrors
                ? 'rejected'
                : unifiedScore >= 75
                    ? 'approved'
                    : unifiedScore >= 50
                        ? 'pending'
                        : 'rejected';

        const { data: audit, error: auditError } = await supabase
            .from('audits')
            .insert({
                company_id: userData.company_id,
                creative_id,
                policy_id: policy?.id || null,
                audit_focus: auditFocus,
                audit_level: 'creative',
                status,
                compliance_score: finalComplianceScore,
                performance_score: finalPerformanceScore,
                issues,
                recommendations,
                ai_analysis: aiAnalysis,
            })
            .select()
            .single();

        if (auditError) {
            console.error('Audit save error:', auditError);
            throw new Error('Failed to save audit');
        }

        try {
            const recItems = buildCreativeAuditRecommendations({
                company_id: userData.company_id,
                creative_id,
                campaign_id: creative.campaign_id ?? null,
                audit_id: audit.id,
                audit_focus: auditFocus,
                aiAnalysis: aiAnalysis as Record<string, unknown> | null,
                perfCompliance,
                overallScore: unifiedScore,
            });
            await persistRecommendations(supabase, recItems);
        } catch (recErr) {
            console.error('Failed to persist recommendations:', recErr);
        }

        return new Response(
            JSON.stringify({
                success: true,
                audit_id: audit.id,
                audit_focus: auditFocus,
                status,
                compliance_score: finalComplianceScore,
                performance_score: finalPerformanceScore,
                issues_count: issues.length,
                has_ai_analysis: !!aiAnalysis,
                has_visual_analysis: !!aiAnalysis?.visual_analysis,
                analysis_mode,
                visual_skipped: !shouldAnalyzeVisual,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        );
    } catch (error) {
        console.error('Audit error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: String(error),
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        );
    }
});
