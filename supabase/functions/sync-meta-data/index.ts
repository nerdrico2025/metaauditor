import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EDGE_FUNCTION_TIMEOUT_MS = 110000; // 110 seconds

async function processPaginated<T>(
    url: string,
    processFn: (data: T[]) => Promise<void>,
    logToDebug?: (msg: string) => void
): Promise<void> {
    let currentUrl = url;
    let pagesProcessed = 0;
    while (currentUrl && pagesProcessed < 5) { // Increased limit
        if (logToDebug) logToDebug(`Fetching URL page ${pagesProcessed + 1}...`);
        const response = await fetch(currentUrl);
        if (!response.ok) {
            const errorMsg = `Meta API Error during pagination: ${response.status} ${response.statusText}`;
            console.error(errorMsg);
            const errorText = await response.text();
            console.error('Meta API Error Body:', errorText);
            if (logToDebug) logToDebug(`${errorMsg} | Body: ${errorText}`);
            break;
        }

        const data = await response.json();
        if (data.data?.length > 0) {
            await processFn(data.data);
        } else {
            if (logToDebug) logToDebug(`Meta API returned 0 items on page ${pagesProcessed + 1}. Raw data preview: ${JSON.stringify(data).substring(0, 150)}`);
        }
        currentUrl = data.paging?.next || null;
        pagesProcessed++;
    }
}

// Map Facebook's objective to exactly what our DB allows
const mapObjective = (objective: string | null | undefined): string | null => {
    if (!objective) return null;
    const objLower = objective.toLowerCase();

    const mapping: Record<string, string> = {
        'brand_awareness': 'awareness',
        'reach': 'awareness',
        'link_clicks': 'traffic',
        'landing_page_views': 'traffic',
        'post_engagement': 'engagement',
        'page_likes': 'engagement',
        'event_responses': 'engagement',
        'lead_generation': 'leads',
        'messages': 'engagement',
        'conversions': 'sales',
        'catalog_sales': 'sales',
        'store_visits': 'awareness',
        'app_installs': 'app_promotion',
        'outcomes_awareness': 'awareness',
        'outcomes_traffic': 'traffic',
        'outcomes_engagement': 'engagement',
        'outcomes_leads': 'leads',
        'outcomes_app_promotion': 'app_promotion',
        'outcomes_sales': 'sales'
    };

    return mapping[objLower] || null;
};

const mapEventType = (goal: string | null | undefined): string | null => {
    if (!goal) return null;
    return goal.toLowerCase();
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const payloadStr = await req.text();
        const payload = JSON.parse(payloadStr);
        let { integration_id, sync_type = "full" } = payload;

        if (!integration_id) {
            return new Response(JSON.stringify({ error: "Missing integration_id" }), { status: 400, headers: corsHeaders });
        }

        const integrationIds = Array.isArray(integration_id) ? integration_id : [integration_id];

        const timestampParamsMatch = req.url.match(/timestamp=(\d+)/);
        const requestTimestamp = timestampParamsMatch ? parseInt(timestampParamsMatch[1]) : Date.now();
        console.log(`[sync-meta-data] Started with sync_type=${sync_type}, integrationIds=${integrationIds.length}, timestamp=${requestTimestamp}`);

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const APP_ID = Deno.env.get("VITE_META_APP_ID")!;
        const APP_SECRET = Deno.env.get("VITE_META_APP_SECRET")!;

        if (!APP_ID || !APP_SECRET) {
            console.error("Missing Meta App credentials in environment variables.");
            return new Response(JSON.stringify({ error: "Configuration Error" }), { status: 500, headers: corsHeaders });
        }

        const results = [];

        for (const id of integrationIds) {
            console.log(`Processing integration ID: ${id}`);
            const { data: integration, error: integrationError } = await supabase
                .from("integrations")
                .select("*")
                .eq("id", id)
                .single();

            if (integrationError || !integration) {
                console.error(`Integration ${id} not found:`, integrationError);
                results.push({ integration_id: id, status: "error", error: "Integration not found" });
                continue;
            }

            const accountType = integration.permissions?.account_type || 'ads_account';

            if (accountType === 'whatsapp_clicks' || accountType === 'disparo') {
                console.log(`Skipping integration ${integration.id} because it is a specialized account type: ${accountType}`);
                results.push({
                    integration_id: integration.id,
                    account_id: integration.account_id,
                    status: "skipped_special_account",
                    items_synced: 0,
                    error: null
                });
                continue;
            }

            const accessToken = integration.access_token;
            const accountId = integration.account_id;

            if (!accessToken || !accountId) {
                console.error(`Invalid integration data for ${id}`);
                results.push({ integration_id: id, status: "error", error: "Missing access token or account ID" });
                continue;
            }

            const fbAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

            const syncStartTime = new Date().toISOString();
            const edgeFunctionStartTime = Date.now();
            let itemsSynced = 0;
            let itemsFailed = 0;
            let lastError = null;
            let debugLogs: string[] = [];

            const logToDebug = (msg: string) => {
                debugLogs.push(msg);
                console.log(msg);
            };

            const isTimeUp = () => (Date.now() - edgeFunctionStartTime) > EDGE_FUNCTION_TIMEOUT_MS;

            const crypto = globalThis.crypto;
            const encoder = new TextEncoder();
            const keyData = encoder.encode(APP_SECRET);
            const msgData = encoder.encode(accessToken);
            const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
            const signature = await crypto.subtle.sign("HMAC", key, msgData);
            const appSecretProof = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");

            const META_API_BASE = "https://graph.facebook.com/v19.0";
            const encodedToken = encodeURIComponent(accessToken) + "&appsecret_proof=" + appSecretProof;

            try {
                if (sync_type === "full") {
                    logToDebug(`Fetching active campaigns for account ${fbAccountId}...`);
                    const campaignsUrl = `${META_API_BASE}/${fbAccountId}/campaigns?fields=id,name,status,objective,budget_remaining,daily_budget,lifetime_budget,spend_cap&limit=100&access_token=${encodedToken}`;

                    let campaignIdMap = new Map<string, string>();

                    await processPaginated<any>(campaignsUrl, async (campaigns) => {
                        const localCampaigns = campaigns.map(c => ({
                            company_id: integration.company_id,
                            platform: "meta",
                            external_id: c.id,
                            name: c.name,
                            status: c.status?.toLowerCase(),
                            objective: mapObjective(c.objective),
                            daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
                            lifetime_budget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
                            spend_cap: c.spend_cap ? parseFloat(c.spend_cap) / 100 : null,
                            updated_at: new Date().toISOString()
                        }));

                        const { data: upsertedCampaigns, error: campaignError } = await supabase
                            .from("campaigns")
                            .upsert(localCampaigns, { onConflict: "company_id,external_id" })
                            .select('id, external_id');

                        if (campaignError) {
                            logToDebug("Bulk Campaign upsert error: " + JSON.stringify(campaignError));
                            itemsFailed += localCampaigns.length;
                            lastError = campaignError;
                        } else if (upsertedCampaigns) {
                            itemsSynced += localCampaigns.length;
                            upsertedCampaigns.forEach(c => campaignIdMap.set(c.external_id, c.id));
                        }
                    });

                    const { data: allCampaigns } = await supabase
                        .from("campaigns")
                        .select("id, external_id")
                        .eq("company_id", integration.company_id)
                        .eq("platform", "meta");

                    allCampaigns?.forEach(c => campaignIdMap.set(c.external_id, c.id));

                    if (campaignIdMap.size === 0) {
                        logToDebug(`No active campaigns found for account ${accountId}. Skipping ads and metrics fetch.`);
                        results.push({
                            integration_id: integration.id,
                            account_id: integration.account_id,
                            items_synced: itemsSynced,
                            items_failed: itemsFailed,
                            status: "skipped_no_ads",
                            error: null,
                            debug: debugLogs
                        });
                        continue;
                    }

                    let adSetIdMap = new Map<string, string>();

                    if (!isTimeUp()) {
                        logToDebug(`Fetching AdSets...`);
                        const adSetsUrl = `${META_API_BASE}/${fbAccountId}/adsets?fields=id,name,campaign_id,status,daily_budget,lifetime_budget,targeting,optimization_goal&limit=100&access_token=${encodedToken}`;

                        await processPaginated<any>(adSetsUrl, async (adSets) => {
                            const localAdSets = adSets.map(a => {
                                const internalCampaignId = campaignIdMap.get(a.campaign_id);
                                if (!internalCampaignId) return null;

                                return {
                                    company_id: integration.company_id,
                                    campaign_id: internalCampaignId,
                                    external_id: a.id,
                                    name: a.name,
                                    status: a.status?.toLowerCase(),
                                    daily_budget: a.daily_budget ? parseFloat(a.daily_budget) / 100 : null,
                                    lifetime_budget: a.lifetime_budget ? parseFloat(a.lifetime_budget) / 100 : null,
                                    event_type: mapEventType(a.optimization_goal),
                                    targeting_rules: a.targeting || {},
                                    updated_at: new Date().toISOString()
                                };
                            }).filter(Boolean);

                            if (localAdSets.length > 0) {
                                const { data: upsertedAdSets, error: adSetError } = await supabase
                                    .from("ad_sets")
                                    .upsert(localAdSets, { onConflict: "company_id,external_id" })
                                    .select('id, external_id');

                                if (adSetError) {
                                    logToDebug("Bulk AdSet upsert error: " + JSON.stringify(adSetError));
                                    itemsFailed += localAdSets.length;
                                    lastError = adSetError;
                                } else if (upsertedAdSets) {
                                    itemsSynced += localAdSets.length;
                                    upsertedAdSets.forEach(a => adSetIdMap.set(a.external_id, a.id));
                                }
                            }
                        });
                    }

                    if (!isTimeUp()) {
                        logToDebug(`Fetching Ads...`);
                        const { data: allAdSets } = await supabase
                            .from("ad_sets")
                            .select("id, external_id")
                            .eq("company_id", integration.company_id);

                        allAdSets?.forEach(a => adSetIdMap.set(a.external_id, a.id));

                        const adsUrl = `${META_API_BASE}/${fbAccountId}/ads?fields=id,name,adset_id,campaign_id,status,creative{object_story_spec,id,image_url,thumbnail_url,body,title,object_type,video_id,call_to_action_type},insights.date_preset(lifetime){impressions,clicks,spend,actions,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,reach,frequency}&limit=50&access_token=${encodedToken}`;

                        await processPaginated<any>(adsUrl, async (ads) => {
                            const adsToUpsert = ads.map(ad => {
                                const internalAdSetId = adSetIdMap.get(ad.adset_id);
                                if (!internalAdSetId) return null;

                                const creative = ad.creative;
                                let format = creative?.object_type ? creative.object_type.toLowerCase() : "post";
                                if (format === 'share') format = 'image';

                                let finalVideoUrl = null;

                                return {
                                    company_id: integration.company_id,
                                    ad_set_id: internalAdSetId,
                                    external_id: ad.id,
                                    name: ad.name,
                                    creative_format: format,
                                    platform: "meta",
                                    status: ad.status?.toLowerCase(),
                                    headline: creative?.title,
                                    description: creative?.body,
                                    image_url: creative?.image_url || creative?.thumbnail_url,
                                    video_url: finalVideoUrl,
                                    call_to_action: creative?.call_to_action_type,
                                    impressions: ad.insights?.data?.[0]?.impressions ? parseInt(ad.insights.data[0].impressions) : 0,
                                    clicks: ad.insights?.data?.[0]?.clicks ? parseInt(ad.insights.data[0].clicks) : 0,
                                    spend: ad.insights?.data?.[0]?.spend ? parseFloat(ad.insights.data[0].spend) : 0,
                                    conversions: ad.insights?.data?.[0]?.actions ?
                                        ad.insights.data[0].actions
                                            .filter((a: any) => ["purchase", "lead", "complete_registration", "contact", "submit_application"].includes(a.action_type))
                                            .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0) : 0,
                                    ctr: ad.insights?.data?.[0]?.impressions && parseInt(ad.insights.data[0].impressions) > 0 ?
                                        (parseInt(ad.insights.data[0].clicks || "0") / parseInt(ad.insights.data[0].impressions)) * 100 : 0,
                                    cpc: ad.insights?.data?.[0]?.clicks && parseInt(ad.insights.data[0].clicks) > 0 ?
                                        parseFloat(ad.insights.data[0].spend || "0") / parseInt(ad.insights.data[0].clicks) : 0,
                                    visual_elements: {
                                        quality_ranking: ad.insights?.data?.[0]?.quality_ranking || null,
                                        engagement_ranking: ad.insights?.data?.[0]?.engagement_rate_ranking || null,
                                        conversion_ranking: ad.insights?.data?.[0]?.conversion_rate_ranking || null,
                                        reach: ad.insights?.data?.[0]?.reach || null,
                                        frequency: ad.insights?.data?.[0]?.frequency || null
                                    },
                                    updated_at: new Date().toISOString()
                                };
                            }).filter(Boolean);

                            if (adsToUpsert.length > 0) {
                                const { error: adsError } = await supabase
                                    .from("creatives")
                                    .upsert(adsToUpsert, { onConflict: "company_id,external_id" });

                                if (adsError) {
                                    logToDebug("Bulk Ads upsert error: " + JSON.stringify(adsError));
                                    itemsFailed += adsToUpsert.length;
                                    lastError = adsError;
                                } else {
                                    itemsSynced += adsToUpsert.length;
                                }
                            }
                        });
                    }
                }

                if (sync_type === "full" || sync_type === "metrics_only") {
                    const today = new Date();
                    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    const dateFormat = (d: Date) => d.toISOString().split("T")[0];
                    const timeRange = JSON.stringify({ since: dateFormat(ninetyDaysAgo), until: dateFormat(today) });

                    const { data: campaignMapData } = await supabase
                        .from("campaigns")
                        .select("id, external_id")
                        .eq("company_id", integration.company_id)
                        .eq("platform", "meta");
                    const metricsCampaignIdMap = new Map<string, string>(campaignMapData?.map((c: any) => [String(c.external_id), c.id]) || []);
                    logToDebug(`Found ${metricsCampaignIdMap.size} campaigns locally for metrics mapping.`);

                    if (!isTimeUp()) {
                        logToDebug(`Starting Campaign Daily Insights...`);
                        const campaignInsightsUrl = `${META_API_BASE}/${fbAccountId}/insights?fields=campaign_id,impressions,clicks,spend,actions&level=campaign&time_range=${encodeURIComponent(timeRange)}&time_increment=1&limit=100&access_token=${encodedToken}`;
                        logToDebug(`Campaign Insights URL prepared.`);

                        await processPaginated<any>(campaignInsightsUrl, async (insights) => {
                            logToDebug(`Received ${insights?.length || 0} campaign insights`);
                            const metrics = insights.map(i => {
                                const localId = metricsCampaignIdMap.get(i.campaign_id);
                                if (!localId) {
                                    logToDebug(`No local ID found for campaign_id: ${i.campaign_id}`);
                                    return null;
                                }
                                return {
                                    company_id: integration.company_id,
                                    campaign_id: localId,
                                    date: i.date_start,
                                    impressions: parseInt(i.impressions) || 0,
                                    clicks: parseInt(i.clicks) || 0,
                                    spend: parseFloat(i.spend) || 0,
                                    conversions: i.actions ? i.actions.filter((a: any) => ["purchase", "lead", "complete_registration"].includes(a.action_type)).reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0) : 0,
                                    created_at: new Date().toISOString()
                                };
                            }).filter(Boolean);
                            logToDebug(`Mapped ${metrics.length} metrics to upsert.`);
                            if (metrics.length > 0) {
                                await supabase.from("campaign_metrics").upsert(metrics, { onConflict: "company_id,campaign_id,date" });
                                itemsSynced += metrics.length;
                            }
                        }, logToDebug);
                    }

                    if (!isTimeUp()) {
                        logToDebug(`Starting AdSet Daily Insights...`);
                        const { data: adSetMapData } = await supabase.from("ad_sets").select("id, external_id").eq("company_id", integration.company_id);
                        const adSetIdMapLookup = new Map(adSetMapData?.map((a: any) => [String(a.external_id), a.id]) || []);
                        logToDebug(`Found ${adSetIdMapLookup.size} adsets locally for metrics mapping.`);

                        const adSetInsightsUrl = `${META_API_BASE}/${fbAccountId}/insights?fields=adset_id,impressions,clicks,spend,actions,reach,frequency,cpc,cpm,ctr&level=adset&time_range=${encodeURIComponent(timeRange)}&time_increment=1&limit=100&access_token=${encodedToken}`;

                        await processPaginated<any>(adSetInsightsUrl, async (insights) => {
                            logToDebug(`Received ${insights?.length || 0} adset insights`);
                            const metrics = insights.map(i => {
                                const localId = adSetIdMapLookup.get(i.adset_id || (i as any).id);
                                if (!localId) {
                                    logToDebug(`No local ID found for adset_id: ${i.adset_id}`);
                                    return null;
                                }
                                return {
                                    company_id: integration.company_id,
                                    ad_set_id: localId,
                                    date: i.date_start,
                                    impressions: parseInt(i.impressions) || 0,
                                    clicks: parseInt(i.clicks) || 0,
                                    spend: parseFloat(i.spend) || 0,
                                    conversions: i.actions ? i.actions.filter((a: any) => ["purchase", "lead", "complete_registration"].includes(a.action_type)).reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0) : 0,
                                    reach: parseInt(i.reach) || 0,
                                    frequency: parseFloat(i.frequency) || 0,
                                    cpc: parseFloat(i.cpc) || 0,
                                    cpm: parseFloat(i.cpm) || 0,
                                    ctr: parseFloat(i.ctr) || 0,
                                    created_at: new Date().toISOString()
                                };
                            }).filter(Boolean);
                            logToDebug(`Mapped ${metrics.length} metrics to upsert.`);
                            if (metrics.length > 0) {
                                await supabase.from("ad_set_metrics").upsert(metrics, { onConflict: "company_id,ad_set_id,date" });
                                itemsSynced += metrics.length;
                            }
                        }, logToDebug);
                    }
                }

                await supabase
                    .from("integrations")
                    .update({ last_sync_at: new Date().toISOString() })
                    .eq("id", integration.id);

                await supabase.from("sync_history").insert({
                    company_id: integration.company_id,
                    integration_id: integration.id,
                    sync_type,
                    status: itemsFailed > 0 ? "completed_with_errors" : "completed",
                    items_synced: itemsSynced,
                    items_failed: itemsFailed,
                    error_message: lastError ? JSON.stringify(lastError) : null,
                    started_at: syncStartTime,
                    completed_at: new Date().toISOString()
                });

                results.push({
                    integration_id: integration.id,
                    account_id: integration.account_id,
                    items_synced: itemsSynced,
                    items_failed: itemsFailed,
                    status: itemsFailed > 0 ? "completed_with_errors" : (itemsSynced === 0 ? "completed_no_data" : "success"),
                    error: lastError ? JSON.stringify(lastError) : null,
                    debug_logs: debugLogs
                });

            } catch (syncError) {
                logToDebug("Sync error for integration: " + JSON.stringify(syncError));

                await supabase.from("sync_history").insert({
                    company_id: integration.company_id,
                    integration_id: integration.id,
                    sync_type,
                    status: "failed",
                    items_synced: itemsSynced,
                    items_failed: itemsFailed,
                    error_message: String(syncError),
                    started_at: syncStartTime,
                    completed_at: new Date().toISOString()
                });

                results.push({
                    integration_id: integration.id,
                    account_id: integration.account_id,
                    status: "error",
                    error: String(syncError),
                    debug_logs: debugLogs
                });
            }
        }

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});