import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const META_API_BASE = "https://graph.facebook.com/v24.0";

const MIN_IMAGE_BYTES = 10 * 1024;

async function downloadAndCache(
    supabase: any,
    imageUrl: string,
    companyId: string,
    adExternalId: string,
    creativeDbId: string,
): Promise<boolean> {
    const dlResp = await fetch(imageUrl, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "image/*,*/*" },
        redirect: "follow",
    });
    if (!dlResp.ok) return false;

    const blob = await dlResp.arrayBuffer();
    if (blob.byteLength < MIN_IMAGE_BYTES) return false;

    const contentType = dlResp.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const storagePath = `${companyId}/${adExternalId}.${ext}`;

    const { error } = await supabase.storage
        .from("creative-assets")
        .upload(storagePath, blob, { contentType, upsert: true });

    if (error) return false;

    const { data: urlData } = supabase.storage
        .from("creative-assets")
        .getPublicUrl(storagePath);

    if (urlData?.publicUrl) {
        await supabase.from("creatives")
            .update({ image_url: urlData.publicUrl })
            .eq("id", creativeDbId);
        return true;
    }
    return false;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { company_id, limit: batchLimit, force_refresh } = await req.json();
        if (!company_id) {
            return new Response(JSON.stringify({ error: "company_id required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const maxItems = batchLimit || 50;
        const startTime = Date.now();
        const TIMEOUT_MS = 55000;
        const isTimeUp = () => Date.now() - startTime > TIMEOUT_MS;

        await supabase.storage.createBucket("creative-assets", {
            public: true,
            fileSizeLimit: 10485760,
        }).catch(() => {});

        let query = supabase
            .from("creatives")
            .select("id, external_id, image_url, campaign_id")
            .eq("company_id", company_id)
            .eq("platform", "meta")
            .limit(maxItems * 3);

        if (!force_refresh) {
            query = query.or(
                "image_url.is.null,image_url.ilike.%fbcdn.net%,image_url.ilike.%facebook.com%",
            );
        }

        const { data: creatives } = await query;
        const toProcess = (creatives || []).slice(0, maxItems);

        if (toProcess.length === 0) {
            return new Response(JSON.stringify({ cached: 0, total: 0, message: "No creatives to process" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const campaignIds = [...new Set(toProcess.map(c => c.campaign_id).filter(Boolean))];
        const { data: campaigns } = await supabase
            .from("campaigns").select("id, integration_id").in("id", campaignIds);

        const integrationIds = [...new Set((campaigns || []).map(c => c.integration_id).filter(Boolean))];
        const { data: integrations } = await supabase
            .from("integrations").select("id, access_token, account_id").in("id", integrationIds);

        const integrationMap = new Map((integrations || []).map(i => [i.id, i]));
        const campaignToIntegration = new Map((campaigns || []).map(c => [c.id, c.integration_id]));

        const processed = new Set<string>();
        let cached = 0;

        const integrationToAdIds = new Map<string, string[]>();
        for (const creative of toProcess) {
            const intId = campaignToIntegration.get(creative.campaign_id);
            if (!intId) continue;
            const list = integrationToAdIds.get(intId) || [];
            list.push(creative.external_id);
            integrationToAdIds.set(intId, list);
        }

        const adIdToCreative = new Map(toProcess.map(c => [c.external_id, c]));

        for (const [intId, adIds] of integrationToAdIds.entries()) {
            if (isTimeUp()) break;
            const integration = integrationMap.get(intId);
            if (!integration?.access_token) continue;
            const token = integration.access_token;

            // Step 1: Batch fetch creative IDs + identify which have thumbnail data
            const adIdToCreativeId = new Map<string, string>();
            const adsWithData: string[] = [];
            const adsWithoutData: string[] = [];

            for (let i = 0; i < adIds.length; i += 50) {
                if (isTimeUp()) break;
                const chunk = adIds.slice(i, i + 50);
                try {
                    const resp = await fetch(
                        `${META_API_BASE}/?ids=${chunk.join(",")}&fields=creative{id,thumbnail_url}&access_token=${token}`
                    );
                    if (!resp.ok) continue;
                    const data = await resp.json();

                    for (const [adId, info] of Object.entries(data as Record<string, any>)) {
                        const cr = (info as any)?.creative;
                        if (cr?.id) {
                            adIdToCreativeId.set(adId, cr.id);
                            if (cr.thumbnail_url) {
                                adsWithData.push(adId);
                            } else {
                                adsWithoutData.push(adId);
                            }
                        }
                    }
                } catch (_) {}
            }

            // Step 2: Fetch HIGH-RES thumbnails for ads with data (prioritized)
            // IMPORTANT: thumbnail_width/height only works on individual GET /{creative_id} endpoint
            for (const adId of adsWithData) {
                if (isTimeUp() || processed.has(adId)) continue;
                const creative = adIdToCreative.get(adId);
                const metaCreativeId = adIdToCreativeId.get(adId);
                if (!creative || !metaCreativeId) continue;

                try {
                    const thumbResp = await fetch(
                        `${META_API_BASE}/${metaCreativeId}?fields=thumbnail_url&thumbnail_width=1080&thumbnail_height=1080&access_token=${token}`
                    );
                    if (!thumbResp.ok) continue;
                    const thumbData = await thumbResp.json();
                    if (!thumbData?.thumbnail_url) continue;

                    const ok = await downloadAndCache(
                        supabase, thumbData.thumbnail_url,
                        company_id, creative.external_id, creative.id
                    );
                    if (ok) {
                        processed.add(adId);
                        cached++;
                    }
                } catch (_) {}
            }

            // Step 3: For PRIVACY_CHECK_FAIL ads, try page tokens
            if (adsWithoutData.length > 0 && !isTimeUp()) {
                const pageTokenCache = new Map<string, string>();
                try {
                    const pagesResp = await fetch(`${META_API_BASE}/me/accounts?fields=id,access_token&limit=100&access_token=${token}`);
                    if (pagesResp.ok) {
                        for (const p of ((await pagesResp.json())?.data || [])) {
                            if (p.id && p.access_token) pageTokenCache.set(p.id, p.access_token);
                        }
                    }
                    const bizResp = await fetch(`${META_API_BASE}/me/businesses?fields=id&limit=50&access_token=${token}`);
                    if (bizResp.ok) {
                        for (const biz of ((await bizResp.json())?.data || [])) {
                            for (const edge of ["owned_pages", "client_pages"]) {
                                try {
                                    const r = await fetch(`${META_API_BASE}/${biz.id}/${edge}?fields=id,access_token&limit=100&access_token=${token}`);
                                    if (r.ok) {
                                        for (const p of ((await r.json())?.data || [])) {
                                            if (p.id && p.access_token) pageTokenCache.set(p.id, p.access_token);
                                        }
                                    }
                                } catch (_) {}
                            }
                        }
                    }
                } catch (_) {}

                if (pageTokenCache.size > 0) {
                    for (const adId of adsWithoutData) {
                        if (isTimeUp() || processed.has(adId)) continue;
                        const creative = adIdToCreative.get(adId);
                        const metaCreativeId = adIdToCreativeId.get(adId);
                        if (!creative || !metaCreativeId) continue;

                        try {
                            const crResp = await fetch(
                                `${META_API_BASE}/${metaCreativeId}?fields=effective_object_story_id&access_token=${token}`
                            );
                            if (!crResp.ok) continue;
                            const crData = await crResp.json();
                            const storyId = crData?.effective_object_story_id;
                            if (!storyId) continue;

                            const pageId = storyId.split("_")[0];
                            const pageToken = pageTokenCache.get(pageId);
                            if (!pageToken) continue;

                            const postResp = await fetch(
                                `${META_API_BASE}/${storyId}?fields=full_picture&access_token=${pageToken}`
                            );
                            if (!postResp.ok) continue;
                            const postData = await postResp.json();
                            if (!postData?.full_picture) continue;

                            const ok = await downloadAndCache(
                                supabase, postData.full_picture,
                                company_id, creative.external_id, creative.id
                            );
                            if (ok) {
                                processed.add(adId);
                                cached++;
                            }
                        } catch (_) {}
                    }
                }
            }
        }

        return new Response(JSON.stringify({
            cached,
            remaining: toProcess.length - cached,
            total: toProcess.length,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
