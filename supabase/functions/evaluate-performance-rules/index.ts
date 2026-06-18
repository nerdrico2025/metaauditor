import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ACTIVE_CAMPAIGN_STATUS_OR, fetchActiveCampaignIds } from '../_shared/activeCampaignScope.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_BASE = 'https://graph.facebook.com/v24.0';
const UNDO_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

interface TriggerConditions {
    metric: string;
    operator: 'lt' | 'lte' | 'gt' | 'gte';
    threshold: number;
    window_days: number;
    mode?: 'snapshot' | 'historical_avg'; // from template or rule config
}

/**
 * evaluate-performance-rules v2 (FURY v0)
 * - Multi-level: evaluates campaigns, adsets, AND ads based on rule.applies_to
 * - Logs every action to fury_actions (with undo support)
 * - Supports both user-initiated and cron (service role) calls
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        let companyIds: string[] = [];

        // Determine auth mode: user JWT or cron (service role)
        const body = await req.json().catch(() => ({}));

        if (body.cron === true) {
            // Cron mode: iterate all companies with active rules
            const { data: companies } = await supabase
                .from('automation_rules')
                .select('company_id')
                .eq('status', 'active')
                .eq('trigger_type', 'metric_threshold');
            const uniqueIds = [...new Set((companies || []).map((c: any) => c.company_id))];

            // Prioritize by investment: companies with higher recent spend go first
            if (uniqueIds.length > 1) {
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                const { data: spendData } = await supabase
                    .from('campaign_metrics')
                    .select('company_id, spend')
                    .in('company_id', uniqueIds)
                    .gte('date', yesterday);

                const spendByCompany = new Map<string, number>();
                (spendData || []).forEach((m: any) => {
                    spendByCompany.set(m.company_id, (spendByCompany.get(m.company_id) || 0) + Number(m.spend || 0));
                });

                uniqueIds.sort((a, b) => (spendByCompany.get(b) || 0) - (spendByCompany.get(a) || 0));
            }

            companyIds = uniqueIds;
        } else {
            // User mode: use JWT
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
            companyIds = [userData.company_id];
        }

        const allResults: any[] = [];

        for (const companyId of companyIds) {
            const result = await evaluateCompany(supabase, companyId);
            allResults.push({ company_id: companyId, ...result });
        }

        return new Response(JSON.stringify({
            success: true,
            companies_evaluated: companyIds.length,
            results: allResults,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('evaluate-performance-rules error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: String(error),
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});

async function evaluateCompany(supabase: any, companyId: string) {
    // 1. Fetch active rules
    const { data: rules, error: rulesError } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .eq('trigger_type', 'metric_threshold');

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) return { rules_evaluated: 0, triggers_fired: 0 };

    const now = Date.now();
    const triggered: any[] = [];

    for (const rule of rules) {
        const conditions = rule.trigger_conditions as TriggerConditions;
        if (!conditions?.metric || !conditions?.operator || conditions?.threshold == null) continue;

        // Cooldown check
        if (rule.last_triggered_at) {
            const lastTrigger = new Date(rule.last_triggered_at).getTime();
            if (now - lastTrigger < COOLDOWN_MS) continue;
        }

        const appliesTo = rule.applies_to || 'campaign';

        // Evaluate against matching entities
        if (appliesTo === 'campaign' || appliesTo === 'all') {
            const results = await evaluateCampaigns(supabase, companyId, rule, conditions);
            triggered.push(...results);
        }
        if (appliesTo === 'adset' || appliesTo === 'all') {
            const results = await evaluateAdSets(supabase, companyId, rule, conditions);
            triggered.push(...results);
        }
        if (appliesTo === 'ad' || appliesTo === 'all') {
            const results = await evaluateAds(supabase, companyId, rule, conditions);
            triggered.push(...results);
        }

        // Update rule trigger count if any triggers fired
        const ruleTriggers = triggered.filter(t => t.rule_id === rule.id);
        if (ruleTriggers.length > 0) {
            await supabase
                .from('automation_rules')
                .update({
                    trigger_count: (rule.trigger_count || 0) + ruleTriggers.length,
                    last_triggered_at: new Date().toISOString(),
                })
                .eq('id', rule.id);
        }
    }

    // Log to sync_history (summary)
    await supabase.from('sync_history').insert({
        company_id: companyId,
        sync_type: 'performance_rules_eval',
        status: 'completed',
        records_synced: triggered.length,
        details: {
            rules_evaluated: rules.length,
            triggers_fired: triggered.length,
        },
    }).catch(() => {});

    return {
        rules_evaluated: rules.length,
        triggers_fired: triggered.length,
        details: triggered,
    };
}

// --- Campaign evaluation ---
async function evaluateCampaigns(supabase: any, companyId: string, rule: any, conditions: TriggerConditions) {
    const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, external_id, status, integration_id, daily_budget')
        .eq('company_id', companyId)
        .not('integration_id', 'is', null)
        .or(ACTIVE_CAMPAIGN_STATUS_OR);

    if (!campaigns || campaigns.length === 0) return [];

    const evalMode = rule.evaluation_mode || conditions.mode || 'snapshot';
    const windowDays = conditions.window_days || 7;

    if (evalMode === 'historical_avg') {
        // Aggregate from campaign_metrics over window
        const since = new Date(Date.now() - windowDays * 86400000).toISOString().split('T')[0];
        const campaignIds = campaigns.map((c: any) => c.id);

        const { data: metrics } = await supabase
            .from('campaign_metrics')
            .select('campaign_id, impressions, clicks, spend, conversions, reach')
            .eq('company_id', companyId)
            .in('campaign_id', campaignIds)
            .gte('date', since);

        const totals = aggregateMetrics(metrics || [], 'campaign_id', windowDays);

        const enriched = campaigns.map((c: any) => {
            const t = totals.get(c.id);
            if (!t) return { ...c, impressions: 0, clicks: 0, spend: 0, conversions: 0, ctr: 0, cpc: 0 };
            return {
                ...c,
                impressions: t.impressions,
                clicks: t.clicks,
                spend: t.spend,
                conversions: t.conversions,
                ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
                cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
                budget_usage_pct: c.daily_budget > 0 ? (t.spend / windowDays / c.daily_budget) * 100 : 0,
            };
        });
        return evaluateEntities(supabase, companyId, rule, conditions, enriched, 'campaign');
    } else {
        // Snapshot: read current totals from campaigns table (lifetime from creatives aggregation)
        const { data: fullCampaigns } = await supabase
            .from('campaigns')
            .select('id, name, external_id, status, integration_id, impressions, clicks, spend, ctr, cpc, conversions, daily_budget')
            .eq('company_id', companyId)
            .not('integration_id', 'is', null)
            .or(ACTIVE_CAMPAIGN_STATUS_OR);
        return evaluateEntities(supabase, companyId, rule, conditions, fullCampaigns || [], 'campaign');
    }
}

// --- AdSet evaluation (always from ad_set_metrics — daily breakdown) ---
async function evaluateAdSets(supabase: any, companyId: string, rule: any, conditions: TriggerConditions) {
    const { data: adSets } = await supabase
        .from('ad_sets')
        .select('id, name, external_id, status, campaign_id, daily_budget')
        .eq('company_id', companyId);

    if (!adSets || adSets.length === 0) return [];

    const windowDays = conditions.window_days || 7;
    const since = new Date(Date.now() - windowDays * 86400000).toISOString().split('T')[0];

    const adSetIds = adSets.map((a: any) => a.id);
    const { data: metrics } = await supabase
        .from('ad_set_metrics')
        .select('ad_set_id, impressions, clicks, spend, conversions, frequency')
        .eq('company_id', companyId)
        .in('ad_set_id', adSetIds)
        .gte('date', since);

    const totals = aggregateMetrics(metrics || [], 'ad_set_id', windowDays);

    // Find integration_id via campaigns
    const campaignIds = [...new Set(adSets.map((a: any) => a.campaign_id))];
    const { data: campaignIntegrations } = await supabase
        .from('campaigns')
        .select('id, integration_id, status')
        .in('id', campaignIds)
        .or(ACTIVE_CAMPAIGN_STATUS_OR);
    const campaignToIntegration = new Map((campaignIntegrations || []).map((c: any) => [c.id, c.integration_id]));
    const activeCampaignIds = new Set((campaignIntegrations || []).map((c: any) => c.id));

    const scopedAdSets = adSets.filter((a: any) => activeCampaignIds.has(a.campaign_id));

    const enriched = scopedAdSets.map((a: any) => {
        const t = totals.get(a.id);
        if (!t) return { ...a, integration_id: campaignToIntegration.get(a.campaign_id), impressions: 0, clicks: 0, spend: 0, conversions: 0, frequency: 0, ctr: 0, cpc: 0 };
        return {
            ...a,
            integration_id: campaignToIntegration.get(a.campaign_id),
            impressions: t.impressions,
            clicks: t.clicks,
            spend: t.spend,
            conversions: t.conversions,
            frequency: t.frequency,
            ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
            cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
        };
    });

    return evaluateEntities(supabase, companyId, rule, conditions, enriched, 'adset');
}

// --- Ad (creative) evaluation ---
async function evaluateAds(supabase: any, companyId: string, rule: any, conditions: TriggerConditions) {
    const activeCampaignIds = await fetchActiveCampaignIds(supabase, companyId);
    if (activeCampaignIds.length === 0) return [];

    const { data: ads } = await supabase
        .from('creatives')
        .select('id, name, external_id, status, ad_set_id, campaign_id, impressions, clicks, spend, conversions, ctr, cpc')
        .eq('company_id', companyId)
        .eq('platform', 'meta')
        .in('campaign_id', activeCampaignIds);

    if (!ads || ads.length === 0) return [];

    // Find integration_id via ad_sets → campaigns
    const adSetIds = [...new Set(ads.map((a: any) => a.ad_set_id).filter(Boolean))];
    const { data: adSetsData } = await supabase
        .from('ad_sets')
        .select('id, campaign_id')
        .in('id', adSetIds);

    const campaignIds = [...new Set((adSetsData || []).map((a: any) => a.campaign_id))];
    const { data: campaignIntegrations } = await supabase
        .from('campaigns')
        .select('id, integration_id')
        .in('id', campaignIds);

    const adSetToCampaign = new Map((adSetsData || []).map((a: any) => [a.id, a.campaign_id]));
    const campaignToIntegration = new Map((campaignIntegrations || []).map((c: any) => [c.id, c.integration_id]));

    const enriched = ads.map((a: any) => ({
        ...a,
        integration_id: campaignToIntegration.get(adSetToCampaign.get(a.ad_set_id)),
    }));

    return evaluateEntities(supabase, companyId, rule, conditions, enriched, 'ad');
}

// --- Generic entity evaluator ---
async function evaluateEntities(
    supabase: any,
    companyId: string,
    rule: any,
    conditions: TriggerConditions,
    entities: any[],
    entityType: 'campaign' | 'adset' | 'ad'
) {
    const triggered: any[] = [];

    for (const entity of entities) {
        const status = (entity.status || '').toLowerCase();
        if (status === 'paused' || status === 'deleted' || status === 'archived') continue;

        const metricValue = getMetricValue(entity, conditions.metric);
        if (metricValue === null) continue;

        const isTriggered = evaluateCondition(metricValue, conditions.operator, conditions.threshold);
        if (!isTriggered) continue;

        let actionTaken = false;
        let actionResult = '';

        if (rule.action_type === 'pause_campaign' || rule.action_type === 'pause') {
            const result = await pauseEntityViaMeta(supabase, entity, entityType);
            actionTaken = result.success;
            actionResult = result.message;
        } else if (rule.action_type === 'notify') {
            actionTaken = true;
            actionResult = 'Notification created';
        }

        // Log to fury_actions
        const now = new Date();
        const undoDeadline = new Date(now.getTime() + UNDO_WINDOW_MS);

        await supabase.from('fury_actions').insert({
            company_id: companyId,
            rule_id: rule.id,
            entity_type: entityType,
            entity_id: entity.id,
            entity_external_id: entity.external_id,
            entity_name: entity.name,
            action_type: rule.action_type === 'pause_campaign' ? 'pause' : rule.action_type,
            action_config: {
                old_status: entity.status?.toUpperCase() || 'ACTIVE',
            },
            trigger_metric: conditions.metric,
            trigger_value: metricValue,
            trigger_threshold: conditions.threshold,
            trigger_window_days: conditions.window_days || 1,
            status: actionTaken ? 'executed' : 'failed',
            undo_deadline: undoDeadline.toISOString(),
            executed_at: now.toISOString(),
        }).catch(e => console.warn('Failed to log fury_action:', e));

        triggered.push({
            rule_id: rule.id,
            rule_name: rule.name,
            action_type: rule.action_type,
            entity_type: entityType,
            entity_id: entity.id,
            entity_name: entity.name,
            metric: conditions.metric,
            current_value: metricValue,
            threshold: conditions.threshold,
            action_taken: actionTaken,
            action_result: actionResult,
        });
    }

    return triggered;
}

// --- Aggregate daily metrics into averages over window ---
function aggregateMetrics(metrics: any[], idField: string, windowDays: number) {
    const totals = new Map<string, any>();
    for (const m of metrics) {
        const id = m[idField];
        if (!id) continue;
        const cur = totals.get(id) || { impressions: 0, clicks: 0, spend: 0, conversions: 0, frequency_sum: 0, frequency_count: 0, days: 0 };
        cur.impressions += Number(m.impressions) || 0;
        cur.clicks += Number(m.clicks) || 0;
        cur.spend += Number(m.spend) || 0;
        cur.conversions += Number(m.conversions) || 0;
        if (m.frequency) { cur.frequency_sum += Number(m.frequency); cur.frequency_count++; }
        cur.days++;
        totals.set(id, cur);
    }
    // Compute averages
    for (const [id, t] of totals) {
        t.frequency = t.frequency_count > 0 ? t.frequency_sum / t.frequency_count : 0;
        // For historical_avg mode, these stay as totals over the window
        // The caller computes derived metrics (CTR, CPC, CPA) from totals
    }
    return totals;
}

// --- Metric extraction ---
function getMetricValue(entity: any, metric: string): number | null {
    switch (metric) {
        case 'ctr': return entity.ctr != null ? Number(entity.ctr) : null;
        case 'cpc': return entity.cpc != null ? Number(entity.cpc) : null;
        case 'cpm': {
            const imp = Number(entity.impressions) || 0;
            const spend = Number(entity.spend) || 0;
            return imp > 0 ? (spend / imp) * 1000 : null;
        }
        case 'cpa': {
            const conv = Number(entity.conversions) || 0;
            const spend = Number(entity.spend) || 0;
            return conv > 0 ? spend / conv : null;
        }
        case 'frequency': return entity.frequency != null ? Number(entity.frequency) : null;
        case 'budget_usage_pct': return entity.budget_usage_pct != null ? Number(entity.budget_usage_pct) : null;
        case 'impressions': return entity.impressions != null ? Number(entity.impressions) : null;
        case 'clicks': return entity.clicks != null ? Number(entity.clicks) : null;
        case 'conversions': return entity.conversions != null ? Number(entity.conversions) : null;
        case 'spend': return entity.spend != null ? Number(entity.spend) : null;
        default: return null;
    }
}

// --- Condition evaluator ---
function evaluateCondition(value: number, operator: string, threshold: number): boolean {
    if (value === 0) return false; // Skip entities with no data
    switch (operator) {
        case 'lt': return value < threshold;
        case 'lte': return value <= threshold;
        case 'gt': return value > threshold;
        case 'gte': return value >= threshold;
        default: return false;
    }
}

// --- Meta API pause ---
async function pauseEntityViaMeta(
    supabase: any,
    entity: any,
    entityType: 'campaign' | 'adset' | 'ad'
): Promise<{ success: boolean; message: string }> {
    if (!entity.external_id || !entity.integration_id) {
        return { success: false, message: 'Missing external_id or integration_id' };
    }

    try {
        const { data: integration } = await supabase
            .from('integrations')
            .select('access_token')
            .eq('id', entity.integration_id)
            .single();

        if (!integration?.access_token) {
            return { success: false, message: 'Access token not found' };
        }

        const token = encodeURIComponent(integration.access_token);
        const response = await fetch(
            `${META_API_BASE}/${entity.external_id}?status=PAUSED&access_token=${token}`,
            { method: 'POST' }
        );

        if (response.ok) {
            const table = entityType === 'campaign' ? 'campaigns'
                : entityType === 'adset' ? 'ad_sets'
                : 'creatives';
            await supabase
                .from(table)
                .update({ status: 'paused' })
                .eq('id', entity.id);
            return { success: true, message: `${entityType} paused via Meta API` };
        } else {
            const errData = await response.json().catch(() => ({}));
            return { success: false, message: `Meta API: ${errData?.error?.message || response.statusText}` };
        }
    } catch (error) {
        return { success: false, message: `Error: ${String(error)}` };
    }
}
