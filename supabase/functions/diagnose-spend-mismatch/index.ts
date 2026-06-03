import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_API_BASE = "https://graph.facebook.com/v24.0";

interface MetaCampaignInsight {
    campaign_id: string;
    campaign_name?: string;
    spend: string;
    impressions: string;
    clicks: string;
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
        );

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }

        const { integrationId, since, until } = await req.json();
        if (!integrationId || !since || !until) {
            return new Response(JSON.stringify({ error: "Missing integrationId, since, or until" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: integration, error: integrationError } = await supabaseAdmin
            .from("integrations")
            .select("*")
            .eq("id", integrationId)
            .eq("user_id", user.id)
            .single();

        if (integrationError || !integration || integration.status !== 'active') {
            return new Response(JSON.stringify({ error: "Integration not found or inactive" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 404,
            });
        }

        const accessToken = integration.access_token;
        const accountId = integration.account_id;
        const fbAccountId = `act_${accountId}`;

        // --- 1. Fetch Meta API campaign-level insights for the period ---
        const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
        const insightsUrl = `${META_API_BASE}/${fbAccountId}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks&level=campaign&time_range=${timeRange}&limit=500&access_token=${encodeURIComponent(accessToken)}`;

        const metaCampaigns: Record<string, { name: string; spend: number; impressions: number; clicks: number }> = {};
        let url: string | null = insightsUrl;
        let metaTotalSpend = 0;
        let metaTotalImpressions = 0;
        let metaTotalClicks = 0;

        while (url) {
            const r = await fetch(url);
            if (!r.ok) {
                const err = await r.text();
                return new Response(JSON.stringify({ error: "Meta API error", detail: err }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 502,
                });
            }
            const json = await r.json();
            for (const ins of (json.data || []) as MetaCampaignInsight[]) {
                const spend = parseFloat(ins.spend) || 0;
                const impressions = parseInt(ins.impressions) || 0;
                const clicks = parseInt(ins.clicks) || 0;
                metaTotalSpend += spend;
                metaTotalImpressions += impressions;
                metaTotalClicks += clicks;
                metaCampaigns[ins.campaign_id] = {
                    name: ins.campaign_name || "(unknown)",
                    spend, impressions, clicks,
                };
            }
            url = json.paging?.next ?? null;
        }

        // --- 2. Local: campaigns table (mapping external_id → local id) ---
        const { data: localCampaigns } = await supabaseAdmin
            .from("campaigns")
            .select("id, external_id, name, status, effective_status")
            .eq("company_id", integration.company_id)
            .eq("integration_id", integration.id);

        const externalToLocal = new Map<string, { id: string; name: string; status: string; effective_status: string }>();
        for (const c of localCampaigns || []) {
            externalToLocal.set(String(c.external_id), { id: c.id, name: c.name, status: c.status, effective_status: c.effective_status });
        }

        // --- 3. Local: campaign_metrics for the period ---
        const localCampaignIds = (localCampaigns || []).map(c => c.id);
        const { data: localMetrics } = await supabaseAdmin
            .from("campaign_metrics")
            .select("campaign_id, date, spend, impressions, clicks, conversions")
            .eq("company_id", integration.company_id)
            .in("campaign_id", localCampaignIds.length > 0 ? localCampaignIds : ["00000000-0000-0000-0000-000000000000"])
            .gte("date", since)
            .lte("date", until);

        const localPerCampaign: Record<string, { spend: number; impressions: number; clicks: number; days: Set<string> }> = {};
        let localTotalSpend = 0;
        let localTotalImpressions = 0;
        let localTotalClicks = 0;

        for (const m of localMetrics || []) {
            const cid = m.campaign_id as string;
            if (!localPerCampaign[cid]) localPerCampaign[cid] = { spend: 0, impressions: 0, clicks: 0, days: new Set() };
            const spend = Number(m.spend || 0);
            const impressions = Number(m.impressions || 0);
            const clicks = Number(m.clicks || 0);
            localPerCampaign[cid].spend += spend;
            localPerCampaign[cid].impressions += impressions;
            localPerCampaign[cid].clicks += clicks;
            localPerCampaign[cid].days.add(m.date as string);
            localTotalSpend += spend;
            localTotalImpressions += impressions;
            localTotalClicks += clicks;
        }

        // --- 4. Build per-campaign comparison ---
        const comparison: Array<{
            external_id: string;
            name: string;
            meta_spend: number;
            local_spend: number;
            diff: number;
            present_locally: boolean;
            local_status: string | null;
            days_synced: number;
        }> = [];

        for (const [extId, meta] of Object.entries(metaCampaigns)) {
            const local = externalToLocal.get(extId);
            const localData = local ? localPerCampaign[local.id] : undefined;
            const localSpend = localData?.spend ?? 0;
            comparison.push({
                external_id: extId,
                name: meta.name,
                meta_spend: meta.spend,
                local_spend: localSpend,
                diff: meta.spend - localSpend,
                present_locally: !!local,
                local_status: local ? `${local.status} / ${local.effective_status}` : null,
                days_synced: localData ? localData.days.size : 0,
            });
        }
        comparison.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

        // --- 5. Build per-day expected vs actual coverage ---
        const expectedDays: string[] = [];
        {
            const s = new Date(since + "T00:00:00");
            const e = new Date(until + "T00:00:00");
            const cur = new Date(s);
            while (cur.getTime() <= e.getTime()) {
                expectedDays.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
                cur.setDate(cur.getDate() + 1);
            }
        }
        const daysWithData = new Set((localMetrics || []).map(m => m.date as string));
        const missingDays = expectedDays.filter(d => !daysWithData.has(d));

        const summary = {
            period: { since, until, expected_days: expectedDays.length },
            totals: {
                meta_spend: metaTotalSpend,
                local_spend: localTotalSpend,
                spend_diff: metaTotalSpend - localTotalSpend,
                meta_impressions: metaTotalImpressions,
                local_impressions: localTotalImpressions,
                meta_clicks: metaTotalClicks,
                local_clicks: localTotalClicks,
            },
            coverage: {
                local_campaigns_in_db: localCampaigns?.length ?? 0,
                campaigns_with_meta_spend: Object.keys(metaCampaigns).length,
                campaigns_missing_locally: comparison.filter(c => !c.present_locally).length,
                missing_days: missingDays,
            },
            top_diff_campaigns: comparison.slice(0, 20),
        };

        return new Response(JSON.stringify(summary, null, 2), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
