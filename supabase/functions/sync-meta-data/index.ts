import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EDGE_FUNCTION_TIMEOUT_MS = 140000; // 140s per integration

// Meta returns the same conversion event under multiple action_types
// (e.g. `lead`, `offsite_conversion.fb_pixel_lead`, `onsite_conversion.lead_grouped`
// all reference the same lead). Naively summing inflates results 2-3x.
// We group action_types into categories; per category we count only the
// FIRST matching type (most-specific/canonical), avoiding double counts.
// One canonical "Result" per campaign objective. `messaging_first_reply` and
// `messaging_welcome_message_flow_complete` are funnel sub-steps of the same
// conversation (already represented by `messaging_conversation_started_7d`) —
// counting them inflates totals 2–3×, so they're excluded.
const RESULT_CATEGORIES: string[][] = [
    // Messaging / WhatsApp — only the canonical "conversation started" event
    ["onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d"],
    // Leads & Registrations — Meta's rolled-up `lead` already includes pixel/onsite variants
    ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"],
    ["complete_registration", "offsite_conversion.fb_pixel_complete_registration"],
    ["submit_application"],
    // Purchases & Sales — omni_purchase is the rollup; web/onsite/offsite are subsets
    ["omni_purchase", "purchase", "onsite_web_purchase", "onsite_conversion.purchase", "offsite_conversion.fb_pixel_purchase"],
    // App installs
    ["mobile_app_install", "app_install"],
    // Contact / WhatsApp click
    ["contact_total", "contact_website"],
];

function countResults(actions: any[] | undefined | null): number {
    if (!actions || actions.length === 0) return 0;
    const byType = new Map<string, number>();
    for (const a of actions) {
        if (a?.action_type) byType.set(a.action_type, parseInt(a.value) || 0);
    }
    let total = 0;
    for (const category of RESULT_CATEGORIES) {
        for (const type of category) {
            if (byType.has(type)) {
                total += byType.get(type) || 0;
                break;
            }
        }
    }
    return total;
}

// Retryable HTTP statuses from Meta API: rate limit + transient server errors
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_PAGES = 50;
const MAX_FETCH_RETRIES = 3;

async function processPaginated<T>(
    url: string,
    processFn: (data: T[]) => Promise<void>,
    logToDebug?: (msg: string) => void,
    maxPagesOverride?: number,
): Promise<void> {
    const pageCap = Math.max(1, maxPagesOverride ?? MAX_PAGES);
    let currentUrl = url;
    let pagesProcessed = 0;

    while (currentUrl && pagesProcessed < pageCap) {
        if (logToDebug) logToDebug(`Fetching URL page ${pagesProcessed + 1}...`);

        // Retry loop for transient failures (429, 5xx, network)
        let response: Response | null = null;
        let lastErrorBody = '';
        for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
            try {
                response = await fetch(currentUrl);
                if (response.ok) break;
                lastErrorBody = await response.text();
                const isRetryable = RETRYABLE_STATUSES.has(response.status);
                if (!isRetryable || attempt === MAX_FETCH_RETRIES) break;
                const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
                if (logToDebug) logToDebug(`Page ${pagesProcessed + 1} returned ${response.status}, retrying in ${delayMs}ms (attempt ${attempt}/${MAX_FETCH_RETRIES})...`);
                await new Promise(r => setTimeout(r, delayMs));
            } catch (fetchErr) {
                if (attempt === MAX_FETCH_RETRIES) {
                    throw new Error(`Meta API network error after ${MAX_FETCH_RETRIES} attempts: ${fetchErr}`);
                }
                const delayMs = 1000 * Math.pow(2, attempt - 1);
                if (logToDebug) logToDebug(`Page ${pagesProcessed + 1} fetch error, retrying in ${delayMs}ms: ${fetchErr}`);
                await new Promise(r => setTimeout(r, delayMs));
            }
        }

        if (!response || !response.ok) {
            const errorMsg = `Meta API Error after retries: ${response?.status} ${response?.statusText}`;
            console.error(errorMsg, lastErrorBody);
            if (logToDebug) logToDebug(`${errorMsg} | Body: ${lastErrorBody.substring(0, 300)}`);
            throw new Error(`${errorMsg} | ${lastErrorBody.substring(0, 200)}`);
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

    if (pagesProcessed >= pageCap && currentUrl) {
        const msg = `WARNING: Pagination cap (${pageCap} pages) reached but more data exists. Some records may be missing.`;
        if (logToDebug) logToDebug(msg);
        console.warn(`[processPaginated] ${msg} URL: ${url.substring(0, 120)}...`);
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
            const edgeFunctionStartTime = Date.now(); // reset per integration
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
                    // Define at top of full-sync block so all sub-blocks can access them
                    const supabaseHost = supabaseUrl.replace('https://', '');
                    const imageHashToAdMap = new Map<string, string[]>();

                    logToDebug(`Fetching active campaigns for account ${fbAccountId}...`);
                    const campaignsUrl = `${META_API_BASE}/${fbAccountId}/campaigns?fields=id,name,status,objective,budget_remaining,daily_budget,lifetime_budget,spend_cap&limit=100&access_token=${encodedToken}`;

                    let campaignIdMap = new Map<string, string>();

                    await processPaginated<any>(campaignsUrl, async (campaigns) => {
                        const localCampaigns = campaigns.map(c => ({
                            company_id: integration.company_id,
                            integration_id: integration.id,
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
                        .eq("integration_id", integration.id)
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
                        const adSetsUrl = `${META_API_BASE}/${fbAccountId}/adsets?fields=id,name,campaign_id,status,daily_budget,lifetime_budget,optimization_goal&limit=200&access_token=${encodedToken}`;

                        logToDebug(`campaignIdMap has ${campaignIdMap.size} entries before fetching adsets.`);
                        await processPaginated<any>(adSetsUrl, async (adSets) => {
                            logToDebug(`Received ${adSets.length} adsets from Meta API.`);
                            const localAdSets = adSets.map(a => {
                                const internalCampaignId = campaignIdMap.get(a.campaign_id);
                                if (!internalCampaignId) {
                                    logToDebug(`AdSet ${a.id}: campaign_id ${a.campaign_id} not in campaignIdMap`);
                                    return null;
                                }

                                return {
                                    company_id: integration.company_id,
                                    campaign_id: internalCampaignId,
                                    platform: "meta",
                                    external_id: a.id,
                                    name: a.name,
                                    status: a.status?.toLowerCase(),
                                    daily_budget: a.daily_budget ? parseFloat(a.daily_budget) / 100 : null,
                                    lifetime_budget: a.lifetime_budget ? parseFloat(a.lifetime_budget) / 100 : null,
                                    event_type: mapEventType(a.optimization_goal),
                                    updated_at: new Date().toISOString()
                                };
                            }).filter(Boolean);

                            logToDebug(`Mapped ${localAdSets.length} valid adsets out of ${adSets.length}.`);

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
                                    logToDebug(`Upserted ${upsertedAdSets.length} adsets successfully.`);
                                    upsertedAdSets.forEach(a => adSetIdMap.set(a.external_id, a.id));
                                }
                            }
                        }, logToDebug);
                    }

                    if (!isTimeUp()) {
                      try {
                        logToDebug(`Fetching Ads...`);
                        const { data: allAdSets } = await supabase
                            .from("ad_sets")
                            .select("id, external_id")
                            .eq("company_id", integration.company_id);

                        allAdSets?.forEach(a => adSetIdMap.set(a.external_id, a.id));

                        // Fetch existing creatives to preserve cached Supabase Storage URLs and video URLs
                        const { data: existingCreatives } = await supabase
                            .from("creatives")
                            .select("external_id, image_url, video_url")
                            .eq("company_id", integration.company_id)
                            .eq("platform", "meta");
                        const cachedImageUrls = new Map<string, string>();
                        const existingVideoUrls = new Map<string, string>();
                        for (const c of existingCreatives || []) {
                            if (c.image_url && c.image_url.includes(supabaseHost)) {
                                cachedImageUrls.set(c.external_id, c.image_url);
                            }
                            if (c.video_url) {
                                existingVideoUrls.set(c.external_id, c.video_url);
                            }
                        }
                        logToDebug(`Found ${cachedImageUrls.size} cached image URLs and ${existingVideoUrls.size} existing video URLs to preserve.`);

                        // Added image_hash to get permanent image references
                        const adsUrl = `${META_API_BASE}/${fbAccountId}/ads?fields=id,name,adset_id,campaign_id,status,creative{object_story_spec,id,image_url,thumbnail_url,image_hash,body,title,object_type,video_id,call_to_action_type}&limit=100&access_token=${encodedToken}`;

                        // Collect video IDs to batch-fetch source URLs after processing ads
                        const videoIdToAdMap = new Map<string, string[]>();

                        await processPaginated<any>(adsUrl, async (ads) => {
                            logToDebug(`Processing batch of ${ads.length} ads from Meta API...`);
                            const adsToUpsert = ads.map(ad => {
                                const internalAdSetId = adSetIdMap.get(ad.adset_id);
                                if (!internalAdSetId) {
                                    logToDebug(`Skipping ad ${ad.id}: adset_id ${ad.adset_id} not in map`);
                                    return null;
                                }

                                const internalCampaignId = campaignIdMap.get(ad.campaign_id);
                                if (!internalCampaignId) {
                                    logToDebug(`Skipping ad ${ad.id}: campaign_id ${ad.campaign_id} not in map`);
                                    return null;
                                }

                                const creative = ad.creative;
                                // Map Meta object_type to our allowed values: image | video | carousel
                                const rawType = (creative?.object_type || '').toLowerCase();
                                let format: string;
                                if (rawType === 'video' || creative?.video_id) {
                                    format = 'video';
                                } else if (rawType === 'carousel' || (creative?.object_story_spec?.link_data?.child_attachments?.length > 0)) {
                                    format = 'carousel';
                                } else {
                                    format = 'image';
                                }

                                // Track video_id for batch URL fetch
                                if (format === 'video' && creative?.video_id) {
                                    const existing = videoIdToAdMap.get(creative.video_id) || [];
                                    existing.push(ad.id);
                                    videoIdToAdMap.set(creative.video_id, existing);
                                }

                                // Track image_hash for batch fresh URL fetch
                                const imageHash = creative?.image_hash;
                                if (imageHash) {
                                    const existing = imageHashToAdMap.get(imageHash) || [];
                                    existing.push(ad.id);
                                    imageHashToAdMap.set(imageHash, existing);
                                }

                                // Extract image_url from multiple possible sources in object_story_spec
                                const oss = creative?.object_story_spec;
                                const extractedImageUrl =
                                    creative?.image_url ||
                                    creative?.thumbnail_url ||
                                    oss?.link_data?.picture ||
                                    oss?.link_data?.image_url ||
                                    oss?.video_data?.image_url ||
                                    oss?.photo_data?.images?.[0]?.source ||
                                    (oss?.link_data?.child_attachments?.[0]?.picture) ||
                                    null;

                                // CRITICAL: Preserve cached Supabase Storage URLs — don't overwrite with expiring Meta CDN URLs
                                const finalImageUrl = cachedImageUrls.get(ad.id) || extractedImageUrl;
                                // Preserve existing video URLs — they get updated separately in batch video fetch
                                const finalVideoUrl = existingVideoUrls.get(ad.id) || null;

                                return {
                                    company_id: integration.company_id,
                                    ad_set_id: internalAdSetId,
                                    campaign_id: internalCampaignId,
                                    external_id: ad.id,
                                    name: ad.name,
                                    type: format,
                                    creative_format: format,
                                    platform: "meta",
                                    status: ad.status?.toLowerCase(),
                                    headline: creative?.title || oss?.link_data?.name || null,
                                    description: creative?.body || oss?.link_data?.message || null,
                                    image_url: finalImageUrl,
                                    video_url: finalVideoUrl,
                                    call_to_action: creative?.call_to_action_type,
                                    updated_at: new Date().toISOString()
                                };
                            }).filter(Boolean);

                            logToDebug(`Mapped ${adsToUpsert.length} valid ads out of ${ads.length}`);
                            if (adsToUpsert.length > 0) {
                                const { error: adsError } = await supabase
                                    .from("creatives")
                                    .upsert(adsToUpsert, { onConflict: "company_id,external_id" });

                                if (adsError) {
                                    logToDebug("Bulk Ads upsert error: " + JSON.stringify(adsError));
                                    itemsFailed += adsToUpsert.length;
                                    lastError = adsError;
                                } else {
                                    logToDebug(`Upserted ${adsToUpsert.length} creatives successfully.`);
                                    itemsSynced += adsToUpsert.length;
                                }
                            }
                        }, logToDebug);

                        // Batch-fetch FULL-RESOLUTION images using image_hash via adimages endpoint
                        if (imageHashToAdMap.size > 0 && !isTimeUp()) {
                            logToDebug(`Fetching full-res images for ${imageHashToAdMap.size} image hashes...`);
                            const imageHashes = Array.from(imageHashToAdMap.keys());
                            for (let i = 0; i < imageHashes.length; i += 50) {
                                if (isTimeUp()) break;
                                const chunk = imageHashes.slice(i, i + 50);
                                try {
                                    const hashParam = encodeURIComponent(JSON.stringify(chunk));
                                    const adImagesUrl = `${META_API_BASE}/${fbAccountId}/adimages?hashes=${hashParam}&fields=hash,url&access_token=${encodedToken}`;
                                    const imgResp = await fetch(adImagesUrl);
                                    if (imgResp.ok) {
                                        const imgData = await imgResp.json();
                                        const images = imgData.data || imgData;
                                        // Response can be { "hash": { hash, url } } or array
                                        const entries = Array.isArray(images) ? images : Object.values(images);
                                        for (const imgInfo of entries as any[]) {
                                            if (!imgInfo?.hash || !imgInfo?.url) continue;
                                            const adExternalIds = imageHashToAdMap.get(imgInfo.hash) || [];
                                            for (const adExtId of adExternalIds) {
                                                // Skip if already cached in Supabase Storage
                                                if (cachedImageUrls.has(adExtId)) continue;
                                                await supabase
                                                    .from("creatives")
                                                    .update({ image_url: imgInfo.url })
                                                    .eq("company_id", integration.company_id)
                                                    .eq("external_id", adExtId);
                                            }
                                        }
                                        logToDebug(`Updated full-res image URLs for chunk ${i / 50 + 1}`);
                                    } else {
                                        logToDebug(`Failed to fetch adimages: ${imgResp.status}`);
                                    }
                                } catch (e) {
                                    logToDebug(`Error fetching adimages: ${e}`);
                                }
                            }
                        }

                        // Batch-fetch video source URLs AND thumbnails from Meta
                        if (videoIdToAdMap.size > 0 && !isTimeUp()) {
                            logToDebug(`Fetching source URLs for ${videoIdToAdMap.size} videos...`);
                            const videoIds = Array.from(videoIdToAdMap.keys());
                            for (let i = 0; i < videoIds.length; i += 50) {
                                const chunk = videoIds.slice(i, i + 50);
                                try {
                                    // Fetch source (playable URL) and picture (thumbnail) for each video
                                    const batchUrl = `${META_API_BASE}/?ids=${chunk.join(",")}&fields=source,picture&access_token=${encodedToken}`;
                                    const videoResp = await fetch(batchUrl);
                                    if (videoResp.ok) {
                                        const videoData = await videoResp.json();
                                        for (const [videoId, info] of Object.entries(videoData as Record<string, any>)) {
                                            const sourceUrl = info?.source;
                                            const pictureUrl = info?.picture;
                                            const adExternalIds = videoIdToAdMap.get(videoId) || [];
                                            for (const adExtId of adExternalIds) {
                                                const updateFields: Record<string, any> = {};
                                                if (sourceUrl) updateFields.video_url = sourceUrl;
                                                // If image_url is not already cached in Supabase Storage, use video thumbnail
                                                if (pictureUrl && !cachedImageUrls.has(adExtId)) {
                                                    updateFields.image_url = pictureUrl;
                                                }
                                                if (Object.keys(updateFields).length > 0) {
                                                    await supabase
                                                        .from("creatives")
                                                        .update(updateFields)
                                                        .eq("company_id", integration.company_id)
                                                        .eq("external_id", adExtId);
                                                }
                                            }
                                        }
                                        logToDebug(`Updated video URLs for chunk ${i / 50 + 1}`);
                                    } else {
                                        logToDebug(`Failed to fetch video URLs: ${videoResp.status}`);
                                    }
                                } catch (e) {
                                    logToDebug(`Error fetching video URLs: ${e}`);
                                }
                            }
                        }
                      } catch (adsBlockError) {
                        // Ads/creatives sync failure must NOT prevent campaign_metrics /
                        // ad_set_metrics / creative_metrics from running. Capture and
                        // continue so spend/impressions/clicks still flow into the dashboard.
                        logToDebug(`Ads block aborted — continuing to metrics: ${adsBlockError}`);
                        lastError = adsBlockError;
                        itemsFailed++;
                      }
                    }

                    // === Cache creative images to Supabase Storage (permanent URLs) ===
                    if (!isTimeUp()) {
                        logToDebug(`Caching creative images to Supabase Storage...`);

                        const { data: uncachedCreatives } = await supabase
                            .from("creatives")
                            .select("id, external_id, image_url, type")
                            .eq("company_id", integration.company_id)
                            .eq("platform", "meta")
                            .not("image_url", "is", null)
                            .limit(200);

                        const toCache = (uncachedCreatives || []).filter(c =>
                            c.image_url && !c.image_url.includes(supabaseHost)
                        );

                        if (toCache.length > 0) {
                            const hashToFreshUrl = new Map<string, string>();
                            if (imageHashToAdMap.size > 0) {
                                logToDebug(`Fetching fresh image URLs via adimages endpoint for ${imageHashToAdMap.size} hashes...`);
                                const allHashes = Array.from(imageHashToAdMap.keys());
                                for (let i = 0; i < allHashes.length; i += 50) {
                                    if (isTimeUp()) break;
                                    const chunk = allHashes.slice(i, i + 50);
                                    try {
                                        const hashesParam = encodeURIComponent(JSON.stringify(chunk));
                                        const adImagesUrl = `${META_API_BASE}/${fbAccountId}/adimages?hashes=${hashesParam}&fields=hash,url&access_token=${encodedToken}`;
                                        const resp = await fetch(adImagesUrl);
                                        if (resp.ok) {
                                            const imgData = await resp.json();
                                            const images = imgData.data || {};
                                            if (typeof images === 'object' && !Array.isArray(images)) {
                                                for (const [hash, info] of Object.entries(images as Record<string, any>)) {
                                                    if (info?.url) hashToFreshUrl.set(hash, info.url);
                                                }
                                            } else if (Array.isArray(images)) {
                                                for (const img of images) {
                                                    if (img?.hash && img?.url) hashToFreshUrl.set(img.hash, img.url);
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        logToDebug(`Error fetching adimages: ${e}`);
                                    }
                                }
                                logToDebug(`Got ${hashToFreshUrl.size} fresh image URLs from adimages endpoint.`);
                            }

                            const adIdToFreshUrl = new Map<string, string>();
                            for (const [hash, adIds] of imageHashToAdMap.entries()) {
                                const freshUrl = hashToFreshUrl.get(hash);
                                if (freshUrl) {
                                    for (const adId of adIds) {
                                        adIdToFreshUrl.set(adId, freshUrl);
                                    }
                                }
                            }

                            await supabase.storage.createBucket('creative-assets', {
                                public: true,
                                fileSizeLimit: 10485760
                            }).catch(() => {});

                            // Cache images in parallel chunks of 6 to cut sync time on large BMs
                            const MIN_BLOB_BYTES = 10 * 1024;

                            const resolveHighResUrl = async (creative: any): Promise<string | null> => {
                                const freshUrl = adIdToFreshUrl.get(creative.external_id);
                                if (freshUrl) return freshUrl;

                                try {
                                    const adResp = await fetch(
                                        `${META_API_BASE}/${creative.external_id}?fields=creative{id}&access_token=${encodedToken}`,
                                    );
                                    if (adResp.ok) {
                                        const adData = await adResp.json();
                                        const metaCreativeId = adData?.creative?.id;
                                        if (metaCreativeId) {
                                            const thumbResp = await fetch(
                                                `${META_API_BASE}/${metaCreativeId}?fields=thumbnail_url&thumbnail_width=1080&thumbnail_height=1080&access_token=${encodedToken}`,
                                            );
                                            if (thumbResp.ok) {
                                                const thumbData = await thumbResp.json();
                                                if (thumbData?.thumbnail_url) return thumbData.thumbnail_url;
                                            }
                                        }
                                    }
                                } catch (_) {}

                                return creative.image_url || null;
                            };

                            const cacheOne = async (creative: any): Promise<boolean> => {
                                try {
                                    const sourceUrl = await resolveHighResUrl(creative);
                                    if (!sourceUrl) return false;

                                    const imgResponse = await fetch(sourceUrl, {
                                        headers: {
                                            "User-Agent": "Mozilla/5.0",
                                            "Accept": "image/*,*/*",
                                        },
                                        redirect: "follow",
                                    });
                                    if (!imgResponse.ok) return false;

                                    const blob = await imgResponse.arrayBuffer();
                                    if (blob.byteLength < MIN_BLOB_BYTES) return false;
                                    const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
                                    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
                                    const storagePath = `${integration.company_id}/${creative.external_id}.${ext}`;

                                    const { error: uploadError } = await supabase.storage
                                        .from('creative-assets')
                                        .upload(storagePath, blob, { contentType, upsert: true });

                                    if (uploadError) return false;

                                    const { data: urlData } = supabase.storage
                                        .from('creative-assets')
                                        .getPublicUrl(storagePath);
                                    if (!urlData?.publicUrl) return false;

                                    const { error: updateError } = await supabase.from("creatives")
                                        .update({ image_url: urlData.publicUrl })
                                        .eq("id", creative.id);
                                    return !updateError;
                                } catch (e) {
                                    logToDebug(`Failed to cache image for ${creative.external_id}: ${e}`);
                                    return false;
                                }
                            };

                            const IMG_CACHE_CONCURRENCY = 6;
                            let cached = 0;
                            for (let i = 0; i < toCache.length; i += IMG_CACHE_CONCURRENCY) {
                                if (isTimeUp()) break;
                                const batch = toCache.slice(i, i + IMG_CACHE_CONCURRENCY);
                                const results = await Promise.all(batch.map(cacheOne));
                                cached += results.filter(Boolean).length;
                            }
                            logToDebug(`Cached ${cached} of ${toCache.length} creative images to storage.`);
                        } else {
                            logToDebug(`All creative images already cached.`);
                        }
                    }
                }

                // Métricas rodam em invocação separada (self-call no fim do "full") para
                // que entidades+cache e os 3 níveis de insights tenham orçamentos de
                // ~150s independentes. Sem isso, contas grandes batem WORKER_RESOURCE_LIMIT.
                if (sync_type === "metrics_only") {
                    const today = new Date();
                    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    const dateFormat = (d: Date) => d.toISOString().split("T")[0];
                    const timeRange = JSON.stringify({ since: dateFormat(ninetyDaysAgo), until: dateFormat(today) });

                    // Fetch the 3 ID maps in parallel
                    logToDebug(`Fetching local ID maps for insights mapping...`);
                    const [creativeMapRes, campaignMapRes, adSetMapRes] = await Promise.all([
                        supabase.from("creatives").select("id, external_id")
                            .eq("company_id", integration.company_id).eq("platform", "meta"),
                        supabase.from("campaigns").select("id, external_id")
                            .eq("company_id", integration.company_id).eq("integration_id", integration.id).eq("platform", "meta"),
                        supabase.from("ad_sets").select("id, external_id")
                            .eq("company_id", integration.company_id),
                    ]);
                    const creativeIdMap = new Map(creativeMapRes.data?.map((c: any) => [String(c.external_id), c.id]) || []);
                    const metricsCampaignIdMap = new Map<string, string>(campaignMapRes.data?.map((c: any) => [String(c.external_id), c.id]) || []);
                    const adSetIdMapLookup = new Map(adSetMapRes.data?.map((a: any) => [String(a.external_id), a.id]) || []);
                    logToDebug(`Maps loaded: ${creativeIdMap.size} creatives, ${metricsCampaignIdMap.size} campaigns, ${adSetIdMapLookup.size} adsets.`);

                    // === Three insight levels run in PARALLEL — independent tables, no dependency ===

                    // Level 1: Ad-level DAILY insights → writes creative_metrics (per-day)
                    // and aggregates a rolling total which is then mirrored onto creatives
                    // (preserves the lifetime view the rest of the app already depends on).
                    const adInsightsTask = async () => {
                        if (isTimeUp()) return;
                        try {
                            logToDebug(`Starting Ad-level Daily Insights (creative_metrics + creatives)...`);
                            // level=ad × time_increment=1 explodes row count (ads × days). Filter to
                            // ACTIVE/PAUSED only (archived ads rarely matter for reporting) and lift
                            // the page cap locally so we don't silently drop data on large accounts.
                            const adInsightsFiltering = encodeURIComponent(JSON.stringify([
                                { field: "ad.effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] }
                            ]));
                            const adInsightsUrl = `${META_API_BASE}/${fbAccountId}/insights?fields=ad_id,impressions,clicks,inline_link_clicks,spend,actions,reach,frequency,cpc,cpm,ctr&level=ad&time_range=${encodeURIComponent(timeRange)}&time_increment=1&filtering=${adInsightsFiltering}&limit=1000&access_token=${encodedToken}`;
                            const adTotals = new Map<string, { impressions: number; clicks: number; inlineLinkClicks: number; spend: number; conversions: number; reach: number }>();
                            let creativeDailySkipped = 0;
                            let creativeDailyWritten = 0;

                            await processPaginated<any>(adInsightsUrl, async (insights) => {
                                logToDebug(`Received ${insights?.length || 0} ad-level daily insights`);
                                const dailyRows: any[] = [];
                                for (const i of insights) {
                                    const adId = i.ad_id;
                                    const localCreativeId = creativeIdMap.get(adId);
                                    if (!localCreativeId) { creativeDailySkipped++; continue; }

                                    const impressions = parseInt(i.impressions) || 0;
                                    const clicks = parseInt(i.clicks) || 0;
                                    const inlineLinkClicks = parseInt(i.inline_link_clicks) || 0;
                                    const spend = parseFloat(i.spend) || 0;
                                    const reach = parseInt(i.reach) || 0;
                                    const conversions = countResults(i.actions);

                                    const nowIso = new Date().toISOString();
                                    dailyRows.push({
                                        company_id: integration.company_id,
                                        creative_id: localCreativeId,
                                        date: i.date_start,
                                        impressions,
                                        clicks,
                                        inline_link_clicks: inlineLinkClicks,
                                        spend,
                                        conversions,
                                        reach,
                                        frequency: parseFloat(i.frequency) || 0,
                                        cpc: parseFloat(i.cpc) || 0,
                                        cpm: parseFloat(i.cpm) || 0,
                                        ctr: parseFloat(i.ctr) || 0,
                                        created_at: nowIso,
                                        updated_at: nowIso,
                                    });

                                    // Accumulate rolling totals keyed by Meta ad_id so we can still
                                    // mirror them onto creatives.* (the lifetime view).
                                    const existing = adTotals.get(adId) || { impressions: 0, clicks: 0, inlineLinkClicks: 0, spend: 0, conversions: 0, reach: 0 };
                                    existing.impressions += impressions;
                                    existing.clicks += clicks;
                                    existing.inlineLinkClicks += inlineLinkClicks;
                                    existing.spend += spend;
                                    existing.conversions += conversions;
                                    existing.reach += reach;
                                    adTotals.set(adId, existing);
                                }

                                if (dailyRows.length > 0) {
                                    const { error: upsertError } = await supabase
                                        .from("creative_metrics")
                                        .upsert(dailyRows, { onConflict: "company_id,creative_id,date" });
                                    if (upsertError) {
                                        logToDebug(`creative_metrics upsert error: ${JSON.stringify(upsertError)}`);
                                        itemsFailed += dailyRows.length;
                                        lastError = upsertError;
                                    } else {
                                        creativeDailyWritten += dailyRows.length;
                                    }
                                }
                            }, logToDebug, 200);

                            logToDebug(`creative_metrics: wrote ${creativeDailyWritten} daily rows, ${creativeDailySkipped} skipped (no local mapping).`);

                            // Pull LIFETIME reach/frequency in a second call (no time_increment).
                            // Summing reach per-day double-counts unique users, so we can't derive
                            // correct lifetime reach/frequency from the daily rows above.
                            const lifetimeReach = new Map<string, { reach: number; frequency: number }>();
                            if (!isTimeUp() && adTotals.size > 0) {
                                try {
                                    const lifetimeUrl = `${META_API_BASE}/${fbAccountId}/insights?fields=ad_id,reach,frequency&level=ad&time_range=${encodeURIComponent(timeRange)}&filtering=${adInsightsFiltering}&limit=1000&access_token=${encodedToken}`;
                                    await processPaginated<any>(lifetimeUrl, async (rows) => {
                                        for (const r of rows) {
                                            if (!r.ad_id) continue;
                                            lifetimeReach.set(r.ad_id, {
                                                reach: parseInt(r.reach) || 0,
                                                frequency: parseFloat(r.frequency) || 0,
                                            });
                                        }
                                    }, logToDebug);
                                    logToDebug(`Lifetime reach/frequency: pulled ${lifetimeReach.size} ads.`);
                                } catch (e) {
                                    logToDebug(`Lifetime reach/frequency fetch failed: ${e}. Falling back to summed daily reach.`);
                                }
                            }

                            // Mirror aggregated totals onto creatives.* so existing list/detail
                            // views that read lifetime metrics keep working unchanged.
                            let adMetricsUpdated = 0;
                            const adEntries = Array.from(adTotals.entries());
                            const now = new Date().toISOString();
                            logToDebug(`Mirroring ${adEntries.length} aggregated totals onto creatives...`);

                            for (let i = 0; i < adEntries.length; i += 10) {
                                if (isTimeUp()) break;
                                const chunk = adEntries.slice(i, i + 10);
                                const results = await Promise.allSettled(chunk.map(([adExternalId, totals]) => {
                                    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
                                    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
                                    const lt = lifetimeReach.get(adExternalId);
                                    const reach = lt ? lt.reach : totals.reach;
                                    const frequency = lt
                                        ? lt.frequency
                                        : (totals.reach > 0 ? totals.impressions / totals.reach : 0);
                                    return supabase.from("creatives").update({
                                        spend: totals.spend, impressions: totals.impressions,
                                        clicks: totals.clicks, inline_link_clicks: totals.inlineLinkClicks,
                                        conversions: totals.conversions,
                                        reach, frequency,
                                        ctr, cpc, updated_at: now
                                    }).eq("company_id", integration.company_id).eq("external_id", adExternalId);
                                }));
                                const succeeded = results.filter(r => r.status === 'fulfilled' && !(r.value as any)?.error).length;
                                adMetricsUpdated += succeeded;
                            }
                            // Count unique creatives synced (not daily rows, to keep itemsSynced
                            // comparable to previous sync runs).
                            itemsSynced += adMetricsUpdated;
                            logToDebug(`Mirrored metrics for ${adMetricsUpdated} of ${adEntries.length} creatives.`);
                        } catch (e) {
                            logToDebug(`Ad-level insights task aborted: ${e}`);
                            lastError = e;
                            itemsFailed++;
                        }
                    };

                    // Level 2: Campaign daily insights → campaign_metrics
                    const campaignInsightsTask = async () => {
                        if (isTimeUp()) return;
                        try {
                            logToDebug(`Starting Campaign Daily Insights...`);
                            const campaignInsightsUrl = `${META_API_BASE}/${fbAccountId}/insights?fields=campaign_id,impressions,clicks,inline_link_clicks,spend,actions,reach,frequency,cpc,cpm,ctr&level=campaign&time_range=${encodeURIComponent(timeRange)}&time_increment=1&limit=500&access_token=${encodedToken}`;

                            let campaignSkipped = 0;
                            await processPaginated<any>(campaignInsightsUrl, async (insights) => {
                                logToDebug(`Received ${insights?.length || 0} campaign insights`);
                                const metrics = insights.map(i => {
                                    const localId = metricsCampaignIdMap.get(i.campaign_id);
                                    if (!localId) { campaignSkipped++; return null; }
                                    return {
                                        company_id: integration.company_id,
                                        campaign_id: localId,
                                        date: i.date_start,
                                        impressions: parseInt(i.impressions) || 0,
                                        clicks: parseInt(i.clicks) || 0,
                                        inline_link_clicks: parseInt(i.inline_link_clicks) || 0,
                                        spend: parseFloat(i.spend) || 0,
                                        conversions: countResults(i.actions),
                                        reach: parseInt(i.reach) || 0,
                                        frequency: parseFloat(i.frequency) || 0,
                                        cpc: parseFloat(i.cpc) || 0,
                                        cpm: parseFloat(i.cpm) || 0,
                                        ctr: parseFloat(i.ctr) || 0,
                                        created_at: new Date().toISOString()
                                    };
                                }).filter(Boolean);
                                if (metrics.length > 0) {
                                    const { error: upsertError } = await supabase.from("campaign_metrics").upsert(metrics, { onConflict: "company_id,campaign_id,date" });
                                    if (upsertError) {
                                        logToDebug(`Campaign metrics upsert error: ${JSON.stringify(upsertError)}`);
                                        itemsFailed += metrics.length;
                                        lastError = upsertError;
                                    } else {
                                        itemsSynced += metrics.length;
                                    }
                                }
                            }, logToDebug);
                            if (campaignSkipped > 0) logToDebug(`Campaign insights: ${campaignSkipped} rows skipped (no local mapping)`);
                        } catch (e) {
                            logToDebug(`Campaign insights task aborted: ${e}`);
                            lastError = e;
                            itemsFailed++;
                        }
                    };

                    // Level 3: AdSet daily insights → ad_set_metrics
                    const adSetInsightsTask = async () => {
                        if (isTimeUp()) return;
                        try {
                            logToDebug(`Starting AdSet Daily Insights...`);
                            const adSetInsightsUrl = `${META_API_BASE}/${fbAccountId}/insights?fields=adset_id,impressions,clicks,inline_link_clicks,spend,actions,reach,frequency,cpc,cpm,ctr&level=adset&time_range=${encodeURIComponent(timeRange)}&time_increment=1&limit=500&access_token=${encodedToken}`;

                            let adSetSkipped = 0;
                            await processPaginated<any>(adSetInsightsUrl, async (insights) => {
                                logToDebug(`Received ${insights?.length || 0} adset insights`);
                                const metrics = insights.map(i => {
                                    const localId = adSetIdMapLookup.get(i.adset_id || (i as any).id);
                                    if (!localId) { adSetSkipped++; return null; }
                                    return {
                                        company_id: integration.company_id,
                                        ad_set_id: localId,
                                        date: i.date_start,
                                        impressions: parseInt(i.impressions) || 0,
                                        clicks: parseInt(i.clicks) || 0,
                                        inline_link_clicks: parseInt(i.inline_link_clicks) || 0,
                                        spend: parseFloat(i.spend) || 0,
                                        conversions: countResults(i.actions),
                                        reach: parseInt(i.reach) || 0,
                                        frequency: parseFloat(i.frequency) || 0,
                                        cpc: parseFloat(i.cpc) || 0,
                                        cpm: parseFloat(i.cpm) || 0,
                                        ctr: parseFloat(i.ctr) || 0,
                                        created_at: new Date().toISOString()
                                    };
                                }).filter(Boolean);
                                if (metrics.length > 0) {
                                    const { error: upsertError } = await supabase.from("ad_set_metrics").upsert(metrics, { onConflict: "company_id,ad_set_id,date" });
                                    if (upsertError) {
                                        logToDebug(`AdSet metrics upsert error: ${JSON.stringify(upsertError)}`);
                                        itemsFailed += metrics.length;
                                        lastError = upsertError;
                                    } else {
                                        itemsSynced += metrics.length;
                                    }
                                }
                            }, logToDebug);
                            if (adSetSkipped > 0) logToDebug(`AdSet insights: ${adSetSkipped} rows skipped (no local mapping)`);
                        } catch (e) {
                            logToDebug(`AdSet insights task aborted: ${e}`);
                            lastError = e;
                            itemsFailed++;
                        }
                    };

                    // Level 4: Account-level reach per preset period.
                    // Reach is NOT additive across days (Meta dedupes unique users), so the
                    // dashboard can't compute period reach from daily rows. We fetch one
                    // reach value per preset window straight from Meta and cache it in
                    // account_period_reach for the UI to read by period_key.
                    const accountReachBucketsTask = async () => {
                        if (isTimeUp()) return;
                        try {
                            const PRESETS: { key: string; days: number }[] = [
                                { key: "1d", days: 1 },
                                { key: "7d", days: 7 },
                                { key: "15d", days: 15 },
                                { key: "30d", days: 30 },
                                { key: "90d", days: 90 },
                            ];
                            // Meta has no same-day data; window ends at yesterday for all presets
                            // (matches useCompanyMetrics' date math).
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            const fmt = (d: Date) => d.toISOString().split("T")[0];
                            const until = fmt(yesterday);

                            const rows: any[] = [];
                            for (const preset of PRESETS) {
                                if (isTimeUp()) break;
                                const since = new Date(yesterday);
                                since.setDate(yesterday.getDate() - preset.days + 1);
                                const range = JSON.stringify({ since: fmt(since), until });
                                const url = `${META_API_BASE}/${fbAccountId}/insights?fields=reach,frequency,impressions&level=account&time_range=${encodeURIComponent(range)}&access_token=${encodedToken}`;
                                try {
                                    const resp = await fetch(url);
                                    if (!resp.ok) {
                                        logToDebug(`account reach ${preset.key}: HTTP ${resp.status}`);
                                        continue;
                                    }
                                    const json = await resp.json();
                                    const r = json?.data?.[0];
                                    if (!r) { logToDebug(`account reach ${preset.key}: empty`); continue; }
                                    rows.push({
                                        company_id: integration.company_id,
                                        integration_id: integration.id,
                                        period_key: preset.key,
                                        reach: parseInt(r.reach) || 0,
                                        frequency: parseFloat(r.frequency) || 0,
                                        impressions: parseInt(r.impressions) || 0,
                                        fetched_at: new Date().toISOString(),
                                    });
                                } catch (e) {
                                    logToDebug(`account reach ${preset.key} fetch failed: ${e}`);
                                }
                            }
                            if (rows.length > 0) {
                                const { error: upsertErr } = await supabase
                                    .from("account_period_reach")
                                    .upsert(rows, { onConflict: "integration_id,period_key" });
                                if (upsertErr) {
                                    logToDebug(`account_period_reach upsert error: ${JSON.stringify(upsertErr)}`);
                                    lastError = upsertErr;
                                } else {
                                    logToDebug(`account_period_reach: upserted ${rows.length} preset rows.`);
                                }
                            }
                        } catch (e) {
                            logToDebug(`Account reach buckets task aborted: ${e}`);
                            lastError = e;
                        }
                    };

                    // Run all four insight tasks in parallel — they hit independent tables.
                    // Each task swallows its own errors via processPaginated/upsert checks
                    // and reports them through itemsFailed/lastError, so Promise.all is safe.
                    await Promise.all([
                        adInsightsTask(),
                        campaignInsightsTask(),
                        adSetInsightsTask(),
                        accountReachBucketsTask(),
                    ]);

                    // Meta often omits reach/frequency at campaign level when time_increment=1,
                    // leaving campaign_metrics.reach NULL even with impressions. Ad set daily
                    // insights include reach — backfill campaign rows with MAX(reach) across
                    // ad sets that day (lower bound vs true deduplicated campaign reach).
                    const backfillCampaignReachFromAdSets = async () => {
                        if (isTimeUp()) return;
                        const campaignIds = [...new Set(Array.from(metricsCampaignIdMap.values()))];
                        if (campaignIds.length === 0) return;

                        const { data: adSetsRows, error: asErr } = await supabase
                            .from("ad_sets")
                            .select("id, campaign_id")
                            .in("campaign_id", campaignIds);
                        if (asErr || !adSetsRows?.length) {
                            logToDebug(`backfill campaign reach: ad_sets ${asErr || "empty"}`);
                            return;
                        }

                        const adSetToCampaign = new Map<string, string>();
                        const adSetIds: string[] = [];
                        for (const r of adSetsRows as { id: string; campaign_id: string }[]) {
                            adSetIds.push(r.id);
                            adSetToCampaign.set(r.id, r.campaign_id);
                        }

                        const since = dateFormat(ninetyDaysAgo);
                        const until = dateFormat(today);
                        const maxReachByCampaignDate = new Map<string, number>();

                        const chunkIds = <T>(arr: T[], size: number): T[][] => {
                            const out: T[][] = [];
                            for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
                            return out;
                        };

                        for (const idChunk of chunkIds(adSetIds, 120)) {
                            if (isTimeUp()) break;
                            const { data: asmRows, error: asmErr } = await supabase
                                .from("ad_set_metrics")
                                .select("ad_set_id, date, reach")
                                .eq("company_id", integration.company_id)
                                .gte("date", since)
                                .lte("date", until)
                                .in("ad_set_id", idChunk);
                            if (asmErr) {
                                logToDebug(`backfill: ad_set_metrics ${JSON.stringify(asmErr)}`);
                                continue;
                            }
                            for (const row of asmRows || []) {
                                const cid = adSetToCampaign.get(row.ad_set_id as string);
                                if (!cid || !row.date) continue;
                                const key = `${cid}|${row.date}`;
                                const rv = Number(row.reach) || 0;
                                maxReachByCampaignDate.set(key, Math.max(maxReachByCampaignDate.get(key) || 0, rv));
                            }
                        }

                        let updated = 0;
                        for (const campChunk of chunkIds(campaignIds, 40)) {
                            if (isTimeUp()) break;
                            const { data: cmRows, error: cmErr } = await supabase
                                .from("campaign_metrics")
                                .select("campaign_id, date, impressions, clicks, spend, reach")
                                .eq("company_id", integration.company_id)
                                .in("campaign_id", campChunk)
                                .gte("date", since)
                                .lte("date", until);
                            if (cmErr || !cmRows?.length) continue;

                            const patchChunk: Promise<unknown>[] = [];
                            for (const row of cmRows as any[]) {
                                const imp = Number(row.impressions) || 0;
                                const cur = row.reach == null ? 0 : Number(row.reach);
                                if (imp <= 0 || cur > 0) continue;
                                const br = maxReachByCampaignDate.get(`${row.campaign_id}|${row.date}`) || 0;
                                if (br <= 0) continue;
                                const clk = Number(row.clicks) || 0;
                                const spd = Number(row.spend) || 0;
                                const freq = imp / br;
                                const ctr = imp > 0 ? (clk / imp) * 100 : 0;
                                const cpc = clk > 0 ? spd / clk : 0;
                                const cpm = imp > 0 ? (spd / imp) * 1000 : 0;
                                patchChunk.push(
                                    supabase
                                        .from("campaign_metrics")
                                        .update({
                                            reach: Math.round(br),
                                            frequency: freq,
                                            ctr,
                                            cpc,
                                            cpm,
                                        })
                                        .eq("company_id", integration.company_id)
                                        .eq("campaign_id", row.campaign_id)
                                        .eq("date", row.date),
                                );
                            }
                            const BATCH = 25;
                            for (let i = 0; i < patchChunk.length; i += BATCH) {
                                if (isTimeUp()) break;
                                await Promise.all(patchChunk.slice(i, i + BATCH));
                            }
                            updated += patchChunk.length;
                        }
                        logToDebug(`backfill campaign_metrics reach from ad_set_metrics: ${updated} updates.`);
                    };

                    await backfillCampaignReachFromAdSets();
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

        // Metrics agora rodam numa segunda chamada disparada pelo client após este
        // "full" retornar. Self-call no Edge era inconsistente (EdgeRuntime.waitUntil
        // nem sempre segura o worker no plano free). O client tem controle melhor.

        // D3: log any per-integration failures into sync_errors so the alert
        // worker can notify admins (table created in 20260529_sync_errors.sql).
        try {
            const failed = (results as any[]).filter(r => r.status === 'error');
            if (failed.length > 0) {
                const rows = failed.map(r => ({
                    integration_id: r.integration_id ?? null,
                    error_message: String(r.error ?? 'Unknown error').slice(0, 1000),
                }));
                await supabase.from('sync_errors').insert(rows);
            }
        } catch (logErr) {
            console.error('Failed to write sync_errors:', logErr);
        }

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Unexpected error:", error);
        // D3: best-effort log of catastrophic failures (no integration context).
        try {
            await supabase.from('sync_errors').insert({
                error_message: `Unexpected sync error: ${error instanceof Error ? error.message : String(error)}`.slice(0, 1000),
            });
        } catch { /* swallow */ }
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
