// Phase C3 (Briefing #12): "Recomendações Click Auditor" at account- or campaign-level.
//
// Input:
//   { scope: 'account', company_id: string, recommendation_focus?: 'performance' | 'branding' }
//   { scope: 'campaign', campaign_id: string, recommendation_focus?: 'performance' | 'branding' }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadCompanyAiContext, formatAiContextForPrompt } from '../_shared/ai-context.ts';
import { persistRecommendations, type RecommendationInsert } from '../_shared/persist-recommendations.ts';
import { fetchActiveCampaignIds, ACTIVE_CAMPAIGN_STATUS_OR } from '../_shared/activeCampaignScope.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RecommendationFocus = 'performance' | 'branding';

interface AccountScope { scope: 'account'; company_id: string; recommendation_focus?: RecommendationFocus }
interface CampaignScope { scope: 'campaign'; campaign_id: string; recommendation_focus?: RecommendationFocus }
type RecommendRequest = AccountScope | CampaignScope;

interface AggregatedMetrics {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    days: number;
    avg_ctr: number;
    avg_cpc: number;
    avg_cpa: number;
}

interface AccountSnapshot {
    label: string;
    metrics: AggregatedMetrics;
    top_campaigns: Array<{ name: string; spend: number; conversions: number; cpa: number; ctr: number }>;
    creative_count: number;
    branding_compliance: { approved: number; rejected: number; pending: number };
    top_violated_rules: Array<{ rule_name: string; count: number }>;
    /** Performance focus extras */
    underperforming_creatives?: Array<{ name: string; ctr: number; cpc: number; spend: number }>;
    active_performance_rules?: Array<{ name: string; metric: string; threshold: number; operator: string }>;
    recent_performance_audits?: { count: number; avg_score: number; low_score_count: number };
    /** Branding focus extras */
    recent_branding_audits?: { count: number; avg_compliance: number; rejected_count: number };
}

const PERFORMANCE_CATEGORIES = new Set(['scaling', 'creative', 'audience', 'budget', 'tracking', 'performance']);
const BRANDING_CATEGORIES = new Set(['branding']);

const SYSTEM_PROMPT_PERFORMANCE = `Você é o estrategista sênior de PERFORMANCE da Click Auditor — especialista em Meta Ads e Google Ads.

Suas recomendações DEVEM:
1. Ser específicas para o anunciante (use o contexto fornecido) — nunca genéricas estilo ChatGPT.
2. Ser ACIONÁVEIS — cada recomendação tem uma ação clara que o gestor de tráfego pode executar HOJE.
3. Ser PRIORIZADAS — comece pelo impacto financeiro maior (CPA, escala, budget).
4. Citar números observados (CTR, CPC, CPA, campanhas) quando justificar uma recomendação.
5. Focar EXCLUSIVAMENTE em performance: escala, criativos, audiência, budget, tracking e regras de métricas.
6. NÃO recomendar branding, compliance visual ou regras de marca — isso é outro módulo.
7. Soar como uma agência humana (Click Auditor), não como um relatório automatizado.

## SAÍDA OBRIGATÓRIA (JSON):
{
  "headline": "Frase de 1 linha resumindo a situação de performance.",
  "summary": "Diagnóstico de 2-3 parágrafos com a leitura geral de performance.",
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "category": "scaling" | "creative" | "audience" | "budget" | "tracking" | "performance",
      "title": "Frase curta de ação.",
      "rationale": "Por que isso importa, citando métricas observadas.",
      "next_step": "Próxima ação concreta (1 frase)."
    }
  ],
  "next_review_date_iso": "Data ISO sugerida para revisão (7-14 dias à frente)."
}

Não inclua texto fora do JSON.`;

const SYSTEM_PROMPT_BRANDING = `Você é o estrategista sênior de BRANDING da Click Auditor — especialista em compliance de criativos e padronização de marca em anúncios.

Suas recomendações DEVEM:
1. Ser específicas para o anunciante (use o contexto fornecido) — nunca genéricas estilo ChatGPT.
2. Ser ACIONÁVEIS — cada recomendação tem uma ação clara que o gestor pode executar HOJE.
3. Ser PRIORIZADAS — comece pelos criativos reprovados e regras mais violadas.
4. Citar números observados (aprovados, reprovados, regras violadas) quando justificar.
5. Focar EXCLUSIVAMENTE em branding: compliance, regras de marca, logo, copy, tom visual.
6. NÃO recomendar escala, budget, CPA ou otimização de tráfego — isso é outro módulo.
7. Soar como uma agência humana (Click Auditor), não como um relatório automatizado.

## SAÍDA OBRIGATÓRIA (JSON):
{
  "headline": "Frase de 1 linha resumindo a situação de branding/compliance.",
  "summary": "Diagnóstico de 2-3 parágrafos com a leitura geral de conformidade.",
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "category": "branding",
      "title": "Frase curta de ação.",
      "rationale": "Por que isso importa, citando compliance observado.",
      "next_step": "Próxima ação concreta (1 frase)."
    }
  ],
  "next_review_date_iso": "Data ISO sugerida para revisão (7-14 dias à frente)."
}

Não inclua texto fora do JSON.`;

async function loadBrandingCompliance(
    supabase: any,
    companyId: string,
    creativeIds?: string[],
): Promise<{ approved: number; rejected: number; pending: number; top_violated_rules: Array<{ rule_name: string; count: number }>; creative_count: number }> {
    let creativeCount = creativeIds?.length;
    if (creativeCount === undefined) {
        const activeCampaignIds = await fetchActiveCampaignIds(supabase, companyId);
        if (activeCampaignIds.length === 0) {
            creativeCount = 0;
        } else {
            const { count } = await supabase
                .from('creatives')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .in('campaign_id', activeCampaignIds);
            creativeCount = count ?? 0;
        }
    }

    let checksQuery = supabase
        .from('creative_rule_checks')
        .select('creative_id, overall_status, results, checked_at')
        .order('checked_at', { ascending: false })
        .limit(2000);

    if (creativeIds && creativeIds.length > 0) {
        checksQuery = checksQuery.in('creative_id', creativeIds);
    } else {
        checksQuery = checksQuery.eq('company_id', companyId);
    }

    const { data: checks } = await checksQuery;
    const latest = new Map<string, any>();
    for (const r of (checks ?? [])) if (!latest.has(r.creative_id)) latest.set(r.creative_id, r);

    let approved = 0, rejected = 0;
    const ruleCount = new Map<string, number>();
    for (const row of latest.values()) {
        if (row.overall_status === 'approved') approved++;
        else if (row.overall_status === 'rejected' || row.overall_status === 'warning') rejected++;
        for (const r of (row.results || [])) {
            if (!r.passed) ruleCount.set(r.rule_name, (ruleCount.get(r.rule_name) ?? 0) + 1);
        }
    }
    const pending = Math.max(0, creativeCount - approved - rejected);
    const top_violated_rules = Array.from(ruleCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([rule_name, count]) => ({ rule_name, count }));

    return { approved, rejected, pending, top_violated_rules, creative_count: creativeCount };
}

async function loadPerformanceExtras(supabase: any, companyId: string, campaignIds: string[]): Promise<{
    underperforming_creatives: AccountSnapshot['underperforming_creatives'];
    active_performance_rules: AccountSnapshot['active_performance_rules'];
    recent_performance_audits: AccountSnapshot['recent_performance_audits'];
}> {
    const activeCampaignIds = await fetchActiveCampaignIds(supabase, companyId);
    const scopedCampaignIds = activeCampaignIds.length > 0 ? activeCampaignIds : ['00000000-0000-0000-0000-000000000000'];

    const { data: creatives } = await supabase
        .from('creatives')
        .select('id, name, ctr, cpc, spend, clicks, impressions')
        .eq('company_id', companyId)
        .in('campaign_id', scopedCampaignIds)
        .order('spend', { ascending: false })
        .limit(100);

    const underperforming_creatives = (creatives ?? [])
        .filter((c: any) => {
            const ctr = Number(c.ctr) || 0;
            const spend = Number(c.spend) || 0;
            return spend > 50 && ctr < 0.8;
        })
        .slice(0, 5)
        .map((c: any) => ({
            name: c.name || c.id,
            ctr: Number(c.ctr) || 0,
            cpc: Number(c.cpc) || 0,
            spend: Number(c.spend) || 0,
        }));

    const { data: rules } = await supabase
        .from('automation_rules')
        .select('name, trigger_conditions, status')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .limit(20);

    const active_performance_rules = (rules ?? []).map((r: any) => {
        const cond = r.trigger_conditions ?? {};
        return {
            name: r.name,
            metric: cond.metric ?? 'unknown',
            threshold: Number(cond.threshold) || 0,
            operator: cond.operator ?? 'lt',
        };
    });

    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: audits } = await supabase
        .from('audits')
        .select('performance_score, status')
        .eq('company_id', companyId)
        .eq('audit_focus', 'performance')
        .gte('created_at', cutoff)
        .limit(200);

    const scores = (audits ?? []).map((a: any) => Number(a.performance_score) || 0);
    const avg_score = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    const low_score_count = scores.filter(s => s < 60).length;

    return {
        underperforming_creatives,
        active_performance_rules,
        recent_performance_audits: {
            count: audits?.length ?? 0,
            avg_score: Math.round(avg_score),
            low_score_count,
        },
    };
}

async function loadBrandingExtras(supabase: any, companyId: string): Promise<{
    recent_branding_audits: AccountSnapshot['recent_branding_audits'];
}> {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: audits } = await supabase
        .from('audits')
        .select('compliance_score, status')
        .eq('company_id', companyId)
        .eq('audit_focus', 'branding')
        .gte('created_at', cutoff)
        .limit(200);

    const scores = (audits ?? []).map((a: any) => Number(a.compliance_score) || 0);
    const avg_compliance = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    const rejected_count = (audits ?? []).filter((a: any) => a.status === 'failed' || a.status === 'rejected').length;

    return {
        recent_branding_audits: {
            count: audits?.length ?? 0,
            avg_compliance: Math.round(avg_compliance),
            rejected_count,
        },
    };
}

async function loadAccountSnapshot(supabase: any, companyId: string, focus: RecommendationFocus): Promise<AccountSnapshot> {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('company_id', companyId)
        .or(ACTIVE_CAMPAIGN_STATUS_OR)
        .limit(500);
    const campaignMap = new Map<string, string>();
    const campaignIds: string[] = [];
    (campaigns ?? []).forEach((c: any) => {
        campaignMap.set(c.id, c.name);
        campaignIds.push(c.id);
    });

    const { data: metrics } = await supabase
        .from('campaign_metrics')
        .select('campaign_id, spend, impressions, clicks, conversions, date')
        .gte('date', cutoff)
        .in('campaign_id', campaignIds.length > 0 ? campaignIds : ['00000000-0000-0000-0000-000000000000']);

    const byCampaign = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number }>();
    const days = new Set<string>();
    let totalSpend = 0, totalImpr = 0, totalClicks = 0, totalConv = 0;
    for (const m of (metrics ?? [])) {
        const c = byCampaign.get(m.campaign_id) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
        c.spend += Number(m.spend) || 0;
        c.impressions += Number(m.impressions) || 0;
        c.clicks += Number(m.clicks) || 0;
        c.conversions += Number(m.conversions) || 0;
        byCampaign.set(m.campaign_id, c);
        days.add(m.date);
        totalSpend += Number(m.spend) || 0;
        totalImpr += Number(m.impressions) || 0;
        totalClicks += Number(m.clicks) || 0;
        totalConv += Number(m.conversions) || 0;
    }
    const top_campaigns = Array.from(byCampaign.entries())
        .map(([id, m]) => ({
            name: campaignMap.get(id) ?? id,
            spend: m.spend,
            conversions: m.conversions,
            cpa: m.conversions > 0 ? m.spend / m.conversions : 0,
            ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
        }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);

    const compliance = await loadBrandingCompliance(supabase, companyId);

    const base: AccountSnapshot = {
        label: 'Conta inteira (últimos 30 dias)',
        metrics: {
            spend: totalSpend,
            impressions: totalImpr,
            clicks: totalClicks,
            conversions: totalConv,
            days: days.size,
            avg_ctr: totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0,
            avg_cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
            avg_cpa: totalConv > 0 ? totalSpend / totalConv : 0,
        },
        top_campaigns,
        creative_count: compliance.creative_count,
        branding_compliance: {
            approved: compliance.approved,
            rejected: compliance.rejected,
            pending: compliance.pending,
        },
        top_violated_rules: compliance.top_violated_rules,
    };

    if (focus === 'performance') {
        const perf = await loadPerformanceExtras(supabase, companyId, campaignIds);
        return { ...base, ...perf };
    }

    const branding = await loadBrandingExtras(supabase, companyId);
    return { ...base, ...branding };
}

async function loadCampaignSnapshot(
    supabase: any,
    campaignId: string,
    focus: RecommendationFocus,
): Promise<{ companyId: string; snap: AccountSnapshot }> {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { data: camp } = await supabase
        .from('campaigns')
        .select('id, name, company_id, objective, daily_budget')
        .eq('id', campaignId)
        .single();
    if (!camp) throw new Error('Campaign not found');

    const { data: metrics } = await supabase
        .from('campaign_metrics')
        .select('spend, impressions, clicks, conversions, date')
        .eq('campaign_id', campaignId)
        .gte('date', cutoff);
    let spend = 0, impressions = 0, clicks = 0, conversions = 0;
    const days = new Set<string>();
    for (const m of (metrics ?? [])) {
        spend += Number(m.spend) || 0;
        impressions += Number(m.impressions) || 0;
        clicks += Number(m.clicks) || 0;
        conversions += Number(m.conversions) || 0;
        days.add(m.date);
    }

    const { data: creatives } = await supabase
        .from('creatives')
        .select('id')
        .eq('campaign_id', campaignId);
    const creativeIds = (creatives ?? []).map((c: any) => c.id);

    const compliance = await loadBrandingCompliance(supabase, camp.company_id, creativeIds);

    const base: AccountSnapshot = {
        label: `Campanha "${camp.name}" (últimos 30 dias)`,
        metrics: {
            spend,
            impressions,
            clicks,
            conversions,
            days: days.size,
            avg_ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            avg_cpc: clicks > 0 ? spend / clicks : 0,
            avg_cpa: conversions > 0 ? spend / conversions : 0,
        },
        top_campaigns: [{
            name: camp.name,
            spend,
            conversions,
            cpa: conversions > 0 ? spend / conversions : 0,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        }],
        creative_count: creativeIds.length,
        branding_compliance: {
            approved: compliance.approved,
            rejected: compliance.rejected,
            pending: compliance.pending,
        },
        top_violated_rules: compliance.top_violated_rules,
    };

    if (focus === 'performance') {
        const perf = await loadPerformanceExtras(supabase, camp.company_id, [campaignId]);
        return { companyId: camp.company_id, snap: { ...base, ...perf } };
    }

    const branding = await loadBrandingExtras(supabase, camp.company_id);
    return { companyId: camp.company_id, snap: { ...base, ...branding } };
}

function buildUserPrompt(snap: AccountSnapshot, contextBlock: string, focus: RecommendationFocus): string {
    const metricsBlock = `Métricas agregadas (${snap.metrics.days} dias com dados):
  Investido: R$ ${snap.metrics.spend.toFixed(2)}
  Impressões: ${snap.metrics.impressions}
  Cliques: ${snap.metrics.clicks}
  Conversões: ${snap.metrics.conversions}
  CTR médio: ${snap.metrics.avg_ctr.toFixed(2)}%
  CPC médio: R$ ${snap.metrics.avg_cpc.toFixed(2)}
  CPA médio: R$ ${snap.metrics.avg_cpa.toFixed(2)}

Top campanhas por gasto:
${snap.top_campaigns.map((c, i) => `  ${i + 1}. ${c.name}: R$ ${c.spend.toFixed(2)} | ${c.conversions} conv | CPA R$ ${c.cpa.toFixed(2)} | CTR ${c.ctr.toFixed(2)}%`).join('\n')}`;

    const brandingBlock = `Compliance de branding (criativos analisados):
  Aprovados: ${snap.branding_compliance.approved}
  Reprovados: ${snap.branding_compliance.rejected}
  Pendentes: ${snap.branding_compliance.pending}

Regras mais violadas:
${snap.top_violated_rules.length === 0 ? '  (nenhuma violação registrada)' : snap.top_violated_rules.map(r => `  - ${r.rule_name} (${r.count}x)`).join('\n')}`;

    let focusBlock = '';
    if (focus === 'performance') {
        const perfAudits = snap.recent_performance_audits;
        focusBlock = `Auditorias de performance (30d): ${perfAudits?.count ?? 0} | score médio: ${perfAudits?.avg_score ?? 0} | abaixo de 60: ${perfAudits?.low_score_count ?? 0}

Regras de performance ativas:
${(snap.active_performance_rules ?? []).length === 0 ? '  (nenhuma regra ativa)' : (snap.active_performance_rules ?? []).map(r => `  - ${r.name}: ${r.metric} ${r.operator} ${r.threshold}`).join('\n')}

Criativos com CTR baixo e gasto relevante:
${(snap.underperforming_creatives ?? []).length === 0 ? '  (nenhum identificado)' : (snap.underperforming_creatives ?? []).map(c => `  - ${c.name}: CTR ${c.ctr.toFixed(2)}% | CPC R$ ${c.cpc.toFixed(2)} | gasto R$ ${c.spend.toFixed(2)}`).join('\n')}`;
    } else {
        const brandAudits = snap.recent_branding_audits;
        focusBlock = `Auditorias de branding (30d): ${brandAudits?.count ?? 0} | compliance médio: ${brandAudits?.avg_compliance ?? 0}% | reprovadas: ${brandAudits?.rejected_count ?? 0}

Total de criativos na conta/campanha: ${snap.creative_count}`;
    }

    const dataSection = focus === 'performance'
        ? `${metricsBlock}\n\n${focusBlock}`
        : `${brandingBlock}\n\n${focusBlock}`;

    return `${contextBlock}\n## DADOS OBSERVADOS\nEscopo: ${snap.label}\nFoco: ${focus === 'performance' ? 'Performance (tráfego e métricas)' : 'Branding (compliance e regras de marca)'}\n\n${dataSection}\n\nGere o JSON com headline, summary, recommendations (ordenadas por prioridade) e next_review_date_iso.`;
}

function normalizeCategory(category: string, focus: RecommendationFocus): RecommendationInsert['category'] {
    const allowed = focus === 'branding'
        ? BRANDING_CATEGORIES
        : PERFORMANCE_CATEGORIES;
    if (allowed.has(category)) return category as RecommendationInsert['category'];
    return focus === 'branding' ? 'branding' : 'scaling';
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        const body = await req.json() as RecommendRequest;
        const focus: RecommendationFocus = body.recommendation_focus === 'branding' ? 'branding' : 'performance';

        let companyId: string;
        let snap: AccountSnapshot;
        if (body.scope === 'campaign') {
            const res = await loadCampaignSnapshot(supabaseClient, body.campaign_id, focus);
            companyId = res.companyId;
            snap = res.snap;
        } else {
            companyId = body.company_id;
            snap = await loadAccountSnapshot(supabaseClient, companyId, focus);
        }

        const ctx = await loadCompanyAiContext(supabaseClient, companyId);
        const contextBlock = formatAiContextForPrompt(ctx);

        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

        const systemPrompt = focus === 'branding' ? SYSTEM_PROMPT_BRANDING : SYSTEM_PROMPT_PERFORMANCE;
        const userPrompt = buildUserPrompt(snap, contextBlock, focus);
        const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                response_format: { type: 'json_object' },
                temperature: 0.6,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
            }),
        });
        if (!llmRes.ok) {
            const errBody = await llmRes.text();
            throw new Error(`LLM call failed: ${llmRes.status} ${errBody}`);
        }
        const llmJson = await llmRes.json();
        const content = llmJson.choices?.[0]?.message?.content;
        if (!content) throw new Error('LLM returned empty content');
        const parsed = JSON.parse(content);

        const sourceType = body.scope === 'campaign' ? 'campaign_analysis' : 'account_analysis';
        const recItems: RecommendationInsert[] = (parsed.recommendations ?? [])
            .slice(0, 10)
            .map((r: {
                priority: 'high' | 'medium' | 'low';
                category: string;
                title: string;
                rationale: string;
                next_step: string;
            }) => ({
                company_id: companyId,
                source_type: sourceType,
                campaign_id: body.scope === 'campaign' ? body.campaign_id : null,
                priority: r.priority,
                category: normalizeCategory(r.category, focus),
                title: r.title,
                rationale: r.rationale ?? '',
                next_step: r.next_step ?? r.title,
            }))
            .filter((r: RecommendationInsert) =>
                focus === 'branding' ? r.category === 'branding' : r.category !== 'branding',
            );

        try {
            await persistRecommendations(supabaseClient, recItems);
        } catch (persistErr) {
            console.error('Failed to persist account recommendations:', persistErr);
        }

        return new Response(
            JSON.stringify({
                success: true,
                scope: body.scope,
                recommendation_focus: focus,
                snapshot: snap,
                recommendation: parsed,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(
            JSON.stringify({ success: false, error: message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
