import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
    evaluatePerformanceRules,
    getCreativeMetricValues,
    perfRulesPassRate,
    type PerfComplianceRow,
    type PerfRuleRow,
} from './performance-eval.ts';

export type EntityAuditLevel = 'campaign' | 'ad_set';

export interface AggregatedMetrics {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
}

export interface ChildCreativeSummary {
    id: string;
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    conversions: number;
}

export interface RuleRollupRow {
    rule_name: string;
    passed: boolean;
    reason: string;
    violating_creative_count: number;
    violating_creative_names: string[];
}

export interface EntityRulesReport {
    aggregated: PerfComplianceRow[];
    rollup: RuleRollupRow[];
    pass_rate: number;
}

function sumMetrics(rows: Array<Record<string, unknown>>): AggregatedMetrics {
    let spend = 0;
    let impressions = 0;
    let clicks = 0;
    let conversions = 0;

    for (const row of rows) {
        spend += Number(row.spend) || 0;
        impressions += Number(row.impressions) || 0;
        clicks += Number(row.clicks) || 0;
        conversions += Number(row.conversions) || 0;
    }

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;

    return { spend, impressions, clicks, conversions, ctr, cpc };
}

function metricsFromDailyRows(
    rows: Array<{ spend?: number; impressions?: number; clicks?: number; conversions?: number }> | null,
    dateStart?: string,
    dateEnd?: string,
): AggregatedMetrics {
    if (!rows?.length) {
        return { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0 };
    }

    let filtered = rows;
    if (dateStart || dateEnd) {
        filtered = rows.filter((r) => {
            const d = (r as { date?: string }).date;
            if (!d) return true;
            if (dateStart && d < dateStart) return false;
            if (dateEnd && d > dateEnd) return false;
            return true;
        });
    }

    if (!filtered.length) {
        return { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0 };
    }

    return sumMetrics(filtered as Record<string, unknown>[]);
}

export async function aggregateCampaignMetrics(
    supabase: SupabaseClient,
    campaignId: string,
    dateStart?: string,
    dateEnd?: string,
): Promise<AggregatedMetrics> {
    let metricsQuery = supabase
        .from('campaign_metrics')
        .select('date, spend, impressions, clicks, conversions')
        .eq('campaign_id', campaignId)
        .order('date', { ascending: false })
        .limit(90);

    if (dateStart) metricsQuery = metricsQuery.gte('date', dateStart);
    if (dateEnd) metricsQuery = metricsQuery.lte('date', dateEnd);

    const { data: metricRows } = await metricsQuery;

    if (metricRows?.length) {
        return metricsFromDailyRows(metricRows, dateStart, dateEnd);
    }

    const { data: creatives } = await supabase
        .from('creatives')
        .select('spend, impressions, clicks, conversions, ctr, cpc')
        .eq('campaign_id', campaignId)
        .ilike('status', 'active');

    if (!creatives?.length) {
        return { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0 };
    }

    return sumMetrics(creatives as Record<string, unknown>[]);
}

export async function aggregateAdSetMetrics(
    supabase: SupabaseClient,
    adSetId: string,
    dateStart?: string,
    dateEnd?: string,
): Promise<AggregatedMetrics> {
    let metricsQuery = supabase
        .from('ad_set_metrics')
        .select('date, spend, impressions, clicks, conversions')
        .eq('ad_set_id', adSetId)
        .order('date', { ascending: false })
        .limit(90);

    if (dateStart) metricsQuery = metricsQuery.gte('date', dateStart);
    if (dateEnd) metricsQuery = metricsQuery.lte('date', dateEnd);

    const { data: metricRows } = await metricsQuery;

    if (metricRows?.length) {
        return metricsFromDailyRows(metricRows, dateStart, dateEnd);
    }

    const { data: creatives } = await supabase
        .from('creatives')
        .select('spend, impressions, clicks, conversions, ctr, cpc')
        .eq('ad_set_id', adSetId)
        .ilike('status', 'active');

    if (!creatives?.length) {
        return { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0 };
    }

    return sumMetrics(creatives as Record<string, unknown>[]);
}

export async function fetchActiveChildCreatives(
    supabase: SupabaseClient,
    opts: { campaignId?: string; adSetId?: string },
): Promise<ChildCreativeSummary[]> {
    let query = supabase
        .from('creatives')
        .select('id, name, spend, impressions, clicks, conversions, ctr, cpc')
        .ilike('status', 'active');

    if (opts.adSetId) query = query.eq('ad_set_id', opts.adSetId);
    else if (opts.campaignId) query = query.eq('campaign_id', opts.campaignId);
    else return [];

    const { data } = await query.order('spend', { ascending: false, nullsFirst: false });
    return (data || []).map((c) => ({
        id: c.id,
        name: c.name || '(Sem nome)',
        spend: Number(c.spend) || 0,
        impressions: Number(c.impressions) || 0,
        clicks: Number(c.clicks) || 0,
        ctr: Number(c.ctr) || 0,
        cpc: Number(c.cpc) || 0,
        conversions: Number(c.conversions) || 0,
    }));
}

export function buildEntityPerformanceRulesReport(
    rules: PerfRuleRow[],
    aggregatedMetrics: AggregatedMetrics,
    childCreatives: ChildCreativeSummary[],
): EntityRulesReport {
    const aggregatedCreative = {
        spend: aggregatedMetrics.spend,
        impressions: aggregatedMetrics.impressions,
        clicks: aggregatedMetrics.clicks,
        conversions: aggregatedMetrics.conversions,
        ctr: aggregatedMetrics.ctr,
        cpc: aggregatedMetrics.cpc,
    };

    const aggregated = evaluatePerformanceRules(rules, aggregatedCreative);

    const rollupMap = new Map<string, { names: string[] }>();
    for (const child of childCreatives) {
        const childResults = evaluatePerformanceRules(rules, child);
        for (const r of childResults) {
            if (r.passed) continue;
            const entry = rollupMap.get(r.rule_name) ?? { names: [] };
            entry.names.push(child.name);
            rollupMap.set(r.rule_name, entry);
        }
    }

    const rollup: RuleRollupRow[] = aggregated.map((row) => {
        const violators = rollupMap.get(row.rule_name);
        return {
            rule_name: row.rule_name,
            passed: row.passed,
            reason: row.reason,
            violating_creative_count: violators?.names.length ?? 0,
            violating_creative_names: violators?.names.slice(0, 5) ?? [],
        };
    });

    return {
        aggregated,
        rollup,
        pass_rate: perfRulesPassRate(aggregated),
    };
}

export function formatMetricsBlock(metrics: AggregatedMetrics, label: string): string {
    return `${label}
Investimento: R$ ${metrics.spend.toFixed(2)}
Impressões: ${metrics.impressions.toLocaleString('pt-BR')}
Cliques: ${metrics.clicks.toLocaleString('pt-BR')}
CTR: ${metrics.ctr.toFixed(2)}%
CPC: R$ ${metrics.cpc.toFixed(2)}
Conversões: ${metrics.conversions.toLocaleString('pt-BR')}`;
}

export function formatRulesBlock(report: EntityRulesReport): string {
    if (!report.aggregated.length) return '(Nenhuma regra de performance ativa configurada)';
    let block = '';
    for (const row of report.rollup) {
        block += `- ${row.rule_name}: ${row.passed ? 'OK' : 'VIOLADA'} — ${row.reason}`;
        if (row.violating_creative_count > 0) {
            block += ` (${row.violating_creative_count} criativo(s): ${row.violating_creative_names.join(', ')})`;
        }
        block += '\n';
    }
    return block;
}

export function formatCreativesBlock(creatives: ChildCreativeSummary[], limit = 5): string {
    if (!creatives.length) return '(Nenhum criativo ativo)';
    const top = creatives.slice(0, limit);
    const bottom = creatives.length > limit ? creatives.slice(-Math.min(3, creatives.length - limit)) : [];

    let block = 'Top criativos por investimento:\n';
    for (const c of top) {
        block += `- ${c.name}: R$ ${c.spend.toFixed(2)}, CTR ${c.ctr.toFixed(2)}%, ${c.clicks} cliques\n`;
    }
    if (bottom.length) {
        block += '\nCriativos com menor desempenho relativo:\n';
        for (const c of bottom) {
            block += `- ${c.name}: R$ ${c.spend.toFixed(2)}, CTR ${c.ctr.toFixed(2)}%\n`;
        }
    }
    return block;
}

export function computeEntityPerformanceScore(
    aiScore: number | null,
    rulesPassRate: number,
    hasRules: boolean,
): number {
    const ai = aiScore ?? 70;
    if (!hasRules) return Math.round(ai);
    return Math.round(ai * 0.6 + rulesPassRate * 0.4);
}

export function aggregatedToCreativeRecord(metrics: AggregatedMetrics): Record<string, number> {
    return getCreativeMetricValues(metrics as unknown as Record<string, unknown>);
}

export function getCampaignExpertPrompt(): string {
    return `Você é um consultor sênior de Performance em Meta Ads.
Analise a CAMPANHA com foco estratégico: estrutura de conjuntos, distribuição de budget, objetivo vs resultados, e oportunidades de escala ou corte.

Responda APENAS em JSON válido com:
{
  "overall_score": number (0-100),
  "executive_summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "action_plan": string[],
  "score_breakdown": {
    "ai_overall": number,
    "performance_rules_pass_rate": number | null,
    "audit_focus": "performance"
  }
}`;
}

export function getAdSetExpertPrompt(): string {
    return `Você é um consultor sênior de Performance em Meta Ads.
Analise o CONJUNTO DE ANÚNCIOS com foco tático: público, rotação de criativos, CTR/CPC do conjunto, e alocação dentro da campanha.

Responda APENAS em JSON válido com:
{
  "overall_score": number (0-100),
  "executive_summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "action_plan": string[],
  "score_breakdown": {
    "ai_overall": number,
    "performance_rules_pass_rate": number | null,
    "audit_focus": "performance"
  }
}`;
}

export async function fetchActivePerformanceRules(
    supabase: SupabaseClient,
    companyId: string,
    ruleIds?: string[],
): Promise<PerfRuleRow[]> {
    let query = supabase
        .from('automation_rules')
        .select('id, name, trigger_type, trigger_conditions, applies_to, status')
        .eq('company_id', companyId)
        .eq('status', 'active');

    if (Array.isArray(ruleIds) && ruleIds.length > 0) {
        query = query.in('id', ruleIds);
    }

    const { data } = await query;

    return (data || []) as PerfRuleRow[];
}

export async function findRecentEntityAudit(
    supabase: SupabaseClient,
    params: {
        companyId: string;
        auditLevel: EntityAuditLevel;
        entityId: string;
        auditFocus: string;
        hours?: number;
    },
) {
    const hours = params.hours ?? 6;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
        .from('audits')
        .select('*')
        .eq('company_id', params.companyId)
        .eq('audit_level', params.auditLevel)
        .eq('audit_focus', params.auditFocus)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);

    if (params.auditLevel === 'campaign') {
        query = query.eq('campaign_id', params.entityId);
    } else {
        query = query.eq('ad_set_id', params.entityId);
    }

    const { data } = await query.maybeSingle();
    return data;
}
