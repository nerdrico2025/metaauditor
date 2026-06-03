import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchActiveCampaignIds } from '../_shared/activeCampaignScope.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * check-creative-rules-batch
 * Runs creative quality rules (from creative_rules table) against multiple creatives.
 * Called automatically after sync or manually from the Regras page.
 *
 * Body: { limit?: number }
 *
 * It fetches creatives that have NEVER been checked or whose last check is older
 * than the most recent rule update, then calls check-creative-rules for each.
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        const { limit = 30 } = await req.json().catch(() => ({}));

        // 1. Check if there are active creative rules
        const { data: activeRules } = await supabase
            .from('creative_rules')
            .select('id, updated_at')
            .eq('company_id', companyId)
            .eq('is_active', true);

        if (!activeRules || activeRules.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No active creative rules to check',
                checked: 0,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Find the most recent rule update time
        const latestRuleUpdate = activeRules.reduce((latest, r) => {
            const t = new Date(r.updated_at).getTime();
            return t > latest ? t : latest;
        }, 0);

        // 2. Get creatives in active campaigns only
        const activeCampaignIds = await fetchActiveCampaignIds(supabase, companyId);
        if (activeCampaignIds.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No creatives in active campaigns to check',
                checked: 0,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const fetchLimit = Math.min(limit * 3, 200);
        const { data: allCreatives, error: creativesError } = await supabase
            .from('creatives')
            .select('id')
            .eq('company_id', companyId)
            .in('campaign_id', activeCampaignIds)
            .limit(fetchLimit);

        if (creativesError || !allCreatives?.length) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No creatives to check',
                checked: 0,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 3. Get latest checks for these creatives
        const creativeIds = allCreatives.map(c => c.id);
        const { data: existingChecks } = await supabase
            .from('creative_rule_checks')
            .select('creative_id, checked_at')
            .eq('company_id', companyId)
            .in('creative_id', creativeIds)
            .order('checked_at', { ascending: false });

        // Build a map of creative_id -> latest check time
        const checkMap: Record<string, number> = {};
        for (const check of (existingChecks || [])) {
            if (!checkMap[check.creative_id]) {
                checkMap[check.creative_id] = new Date(check.checked_at).getTime();
            }
        }

        // 4. Filter to creatives that need checking:
        //    - Never been checked, OR
        //    - Last check is older than the most recent rule update
        const creativesToCheck = creativeIds.filter(id => {
            const lastCheckTime = checkMap[id];
            if (!lastCheckTime) return true; // Never checked
            return lastCheckTime < latestRuleUpdate; // Outdated check
        });

        if (creativesToCheck.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'All creatives are up to date',
                checked: 0,
                total: creativeIds.length,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 5. Call check-creative-rules for each creative
        const checkUrl = `${supabaseUrl}/functions/v1/check-creative-rules`;
        const results = { success: 0, failed: 0, errors: [] as string[] };

        for (const creativeId of creativesToCheck.slice(0, limit)) {
            try {
                const response = await fetch(checkUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ creative_id: creativeId }),
                });

                if (response.ok) {
                    results.success++;
                } else {
                    results.failed++;
                    const errData = await response.json().catch(() => ({}));
                    results.errors.push(`${creativeId}: ${errData.error || 'Unknown error'}`);
                }
            } catch (error) {
                results.failed++;
                results.errors.push(`${creativeId}: ${String(error)}`);
            }

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return new Response(JSON.stringify({
            success: true,
            total_creatives: creativeIds.length,
            needed_check: creativesToCheck.length,
            checked: results.success,
            failed: results.failed,
            errors: results.errors.slice(0, 5),
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('check-creative-rules-batch error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: String(error),
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
