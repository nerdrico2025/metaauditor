/** Shared helpers to evaluate automation_rules (performance) against creative metrics. */

export interface PerformanceRuleLike {
  id?: string;
  name: string;
  trigger_type?: string;
  trigger_conditions?: {
    metric?: string;
    operator?: string;
    threshold?: number;
    window_days?: number;
  } | null;
  action_type?: string;
  applies_to?: string | null;
}

export interface PerformanceViolation {
  rule_name: string;
  metric: string;
  current: number;
  operator: string;
  threshold: number;
  action_type?: string;
}

export interface CreativeMetricsInput {
  ctr?: number | null;
  cpc?: number | null;
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  conversions?: number | null;
}

export function getCreativeMetricValues(c: CreativeMetricsInput): Record<string, number> {
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

/** Regras de métrica sempre avaliam criativos; default de escopo é anúncio. */
export function isAdLevelPerformanceRule(rule: PerformanceRuleLike): boolean {
  if (rule.trigger_type === 'metric_threshold') return true;
  const scope = rule.applies_to || 'ad';
  return scope === 'ad' || scope === 'all';
}

/** Normaliza regra para avaliação por criativo. */
export function asCreativeLevelRule(rule: PerformanceRuleLike): PerformanceRuleLike {
  return { ...rule, applies_to: 'ad' };
}

export function evaluatePerformanceRules(
  rules: PerformanceRuleLike[],
  metrics: CreativeMetricsInput,
): PerformanceViolation[] {
  if (!rules.length) return [];

  const metricValues = getCreativeMetricValues(metrics);
  const violations: PerformanceViolation[] = [];

  for (const rule of rules) {
    if (!isAdLevelPerformanceRule(rule)) continue;

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
    else if (op === 'equal') triggered = current === threshold;

    if (triggered) {
      violations.push({
        rule_name: rule.name,
        metric: cond.metric,
        current,
        operator: op,
        threshold,
        action_type: rule.action_type,
      });
    }
  }

  return violations;
}

export function evaluateSinglePerformanceRule(
  rule: PerformanceRuleLike,
  metrics: CreativeMetricsInput,
): PerformanceViolation | null {
  const violations = evaluatePerformanceRules([rule], metrics);
  return violations[0] ?? null;
}

export function hasSufficientMetricData(
  rule: PerformanceRuleLike,
  metrics: CreativeMetricsInput,
): boolean {
  const cond = rule.trigger_conditions;
  if (!cond?.metric) return false;
  const value = getCreativeMetricValues(metrics)[cond.metric] ?? 0;
  return value !== 0;
}

export function formatPerformanceMetricValue(metric: string, value: number): string {
  const isMonetary = metric === 'cpc' || metric === 'spend';
  const isPercent = metric === 'ctr';
  if (isMonetary) return `R$ ${value.toFixed(2)}`;
  if (isPercent) return `${value.toFixed(2)}%`;
  return String(Math.round(value));
}

export function formatPerformanceThreshold(metric: string, threshold: number): string {
  return formatPerformanceMetricValue(metric, threshold);
}

export function getOperatorSymbol(operator: string): string {
  if (operator === 'lt' || operator === 'less_than') return '<';
  if (operator === 'lte') return '≤';
  if (operator === 'gt' || operator === 'greater_than') return '>';
  if (operator === 'gte') return '≥';
  if (operator === 'equal') return '=';
  return operator;
}
