import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RecommendationInsert {
    company_id: string;
    source_type: 'creative_audit' | 'account_analysis' | 'campaign_analysis';
    creative_id?: string | null;
    campaign_id?: string | null;
    audit_id?: string | null;
    priority: 'high' | 'medium' | 'low';
    category: 'scaling' | 'creative' | 'audience' | 'budget' | 'branding' | 'tracking' | 'performance';
    title: string;
    rationale: string;
    next_step: string;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** Dedupe: skip if same company + title exists in last 24h (same creative when provided). */
async function existsRecentDuplicate(
    supabase: SupabaseClient,
    companyId: string,
    title: string,
    creativeId?: string | null,
): Promise<boolean> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let q = supabase
        .from('click_hero_recommendations')
        .select('id')
        .eq('company_id', companyId)
        .eq('title', title)
        .gte('created_at', since)
        .limit(1);

    if (creativeId) {
        q = q.eq('creative_id', creativeId);
    }

    const { data } = await q.maybeSingle();
    return !!data;
}

export async function persistRecommendations(
    supabase: SupabaseClient,
    items: RecommendationInsert[],
): Promise<number> {
    let inserted = 0;

    for (const item of items) {
        const dup = await existsRecentDuplicate(
            supabase,
            item.company_id,
            item.title,
            item.creative_id,
        );
        if (dup) continue;

        const { error } = await supabase.from('click_hero_recommendations').insert({
            company_id: item.company_id,
            source_type: item.source_type,
            creative_id: item.creative_id ?? null,
            campaign_id: item.campaign_id ?? null,
            audit_id: item.audit_id ?? null,
            priority: item.priority,
            category: item.category,
            title: item.title,
            rationale: item.rationale,
            next_step: item.next_step,
            status: 'open',
        });

        if (!error) inserted++;
    }

    return inserted;
}

export function buildCreativeAuditRecommendations(params: {
    company_id: string;
    creative_id: string;
    campaign_id?: string | null;
    audit_id: string;
    audit_focus?: 'performance' | 'branding';
    aiAnalysis: Record<string, unknown> | null;
    perfCompliance: Array<{ rule_name: string; passed: boolean; reason: string }>;
    overallScore: number;
}): RecommendationInsert[] {
    const {
        company_id,
        creative_id,
        campaign_id,
        audit_id,
        audit_focus = 'performance',
        aiAnalysis,
        perfCompliance,
        overallScore,
    } = params;
    const items: RecommendationInsert[] = [];
    const isBranding = audit_focus === 'branding';

    const actionPlan = (aiAnalysis?.action_plan as string[] | undefined)
        ?? (aiAnalysis?.suggestions as string[] | undefined)
        ?? [];

    const basePriority: 'high' | 'medium' | 'low' =
        overallScore < 50 ? 'high' : overallScore < 75 ? 'medium' : 'low';

    const actionCategory = isBranding ? 'branding' as const : 'creative' as const;

    for (const step of actionPlan.slice(0, 5)) {
        const title = step.replace(/^\d+\.\s*/, '').slice(0, 200);
        if (!title) continue;
        items.push({
            company_id,
            source_type: 'creative_audit',
            creative_id,
            campaign_id,
            audit_id,
            priority: basePriority,
            category: actionCategory,
            title,
            rationale: (aiAnalysis?.executive_summary as string) || (aiAnalysis?.tone_analysis as string) || `Recomendação gerada pela auditoria IA (${audit_focus}).`,
            next_step: step,
        });
    }

    if (!isBranding) {
        for (const pr of perfCompliance.filter(r => !r.passed)) {
            items.push({
                company_id,
                source_type: 'creative_audit',
                creative_id,
                campaign_id,
                audit_id,
                priority: 'high',
                category: 'performance',
                title: `Corrigir: ${pr.rule_name}`,
                rationale: pr.reason,
                next_step: 'Revise métricas e ajuste campanha ou criativo conforme a regra de performance.',
            });
        }
    }

    if (isBranding) {
        const rulesCompliance = aiAnalysis?.rules_compliance as Array<{ rule_name: string; passed: boolean; reason: string }> | undefined;
        if (rulesCompliance) {
            for (const rc of rulesCompliance.filter(r => !r.passed)) {
                items.push({
                    company_id,
                    source_type: 'creative_audit',
                    creative_id,
                    campaign_id,
                    audit_id,
                    priority: 'high',
                    category: 'branding',
                    title: `Branding: ${rc.rule_name}`,
                    rationale: rc.reason,
                    next_step: 'Ajuste o criativo para cumprir a regra de branding configurada.',
                });
            }
        }
    }

    return items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
