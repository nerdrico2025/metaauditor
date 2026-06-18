/** Server-side evaluation of automation_rules (metric_threshold) against creative metrics. */

export interface PerfRuleRow {
    id: string;
    name: string;
    trigger_type?: string;
    trigger_conditions?: {
        metric?: string;
        operator?: string;
        threshold?: number;
    } | null;
    applies_to?: string | null;
    status?: string | null;
}

export interface PerfComplianceRow {
    rule_name: string;
    passed: boolean;
    reason: string;
}

export function getCreativeMetricValues(c: Record<string, unknown>): Record<string, number> {
    const cpc = c.cpc ? Number(c.cpc) : 0;
    const spend = Number(c.spend) || (Number(c.clicks) || 0) * cpc;
    return {
        ctr: c.ctr ? Number(c.ctr) : 0,
        cpc,
        spend,
        impressions: Number(c.impressions) || 0,
        clicks: Number(c.clicks) || 0,
        conversions: Number(c.conversions) || 0,
    };
}

function isAdLevelRule(rule: PerfRuleRow): boolean {
    if (rule.trigger_type === 'metric_threshold') return true;
    const scope = rule.applies_to || 'ad';
    return scope === 'ad' || scope === 'all';
}

export function evaluatePerformanceRules(
    rules: PerfRuleRow[],
    creative: Record<string, unknown>,
): PerfComplianceRow[] {
    const metricValues = getCreativeMetricValues(creative);
    const results: PerfComplianceRow[] = [];

    for (const rule of rules) {
        if (!isAdLevelRule(rule)) continue;
        const cond = rule.trigger_conditions;
        if (!cond?.metric) continue;

        const current = metricValues[cond.metric] ?? 0;
        const threshold = Number(cond.threshold);
        const op = cond.operator || 'lt';
        let triggered = false;

        if (op === 'lt' || op === 'less_than') triggered = current < threshold;
        else if (op === 'lte') triggered = current <= threshold;
        else if (op === 'gt' || op === 'greater_than') triggered = current > threshold;
        else if (op === 'gte') triggered = current >= threshold;
        else if (op === 'equal' || op === 'eq') triggered = current === threshold;

        const isMonetary = cond.metric === 'cpc' || cond.metric === 'spend';
        const isPercent = cond.metric === 'ctr';
        const fmtVal = isMonetary ? `R$ ${current.toFixed(2)}` : isPercent ? `${current.toFixed(2)}%` : String(Math.round(current));
        const fmtThresh = isMonetary ? `R$ ${threshold}` : isPercent ? `${threshold}%` : String(threshold);
        const opSymbol = op === 'lt' || op === 'less_than' ? '<' : op === 'lte' ? '≤' : op === 'gt' || op === 'greater_than' ? '>' : op === 'gte' ? '≥' : '=';

        results.push({
            rule_name: rule.name,
            passed: !triggered,
            reason: triggered
                ? `${cond.metric.toUpperCase()} atual: ${fmtVal} — viola regra (limite: ${opSymbol} ${fmtThresh})`
                : `${cond.metric.toUpperCase()} OK: ${fmtVal} (limite: ${opSymbol} ${fmtThresh})`,
        });
    }

    return results;
}

export function perfRulesPassRate(results: PerfComplianceRow[]): number {
    if (results.length === 0) return 100;
    const passed = results.filter(r => r.passed).length;
    return Math.round((passed / results.length) * 100);
}
