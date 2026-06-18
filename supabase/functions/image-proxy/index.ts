import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const META_API_BASE = "https://graph.facebook.com/v24.0";
const MIN_IMAGE_BYTES = 10 * 1024;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const imageUrl = url.searchParams.get("url");
        const creativeExternalId = url.searchParams.get("ad_id");

        if (!imageUrl) {
            return new Response("Missing url parameter", {
                status: 400,
                headers: corsHeaders,
            });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        let fullResUrl: string | null = null;

        // Strategy: use creative endpoint with thumbnail_width=1080 for HIGH-RES thumbnails
        // This works for ALL creative types including SHARE (no image_hash needed)
        if (creativeExternalId) {
            try {
                // 1. Find the creative, its campaign, and integration
                const { data: creative } = await supabase
                    .from("creatives")
                    .select("id, campaign_id, company_id")
                    .eq("external_id", creativeExternalId)
                    .limit(1)
                    .single();

                if (creative?.campaign_id) {
                    const { data: campaign } = await supabase
                        .from("campaigns")
                        .select("integration_id")
                        .eq("id", creative.campaign_id)
                        .single();

                    if (campaign?.integration_id) {
                        const { data: integration } = await supabase
                            .from("integrations")
                            .select("access_token, account_id")
                            .eq("id", campaign.integration_id)
                            .single();

                        if (integration?.access_token) {
                            const token = integration.access_token;

                            // 2. Get the creative ID from the ad
                            const adResp = await fetch(
                                `${META_API_BASE}/${creativeExternalId}?fields=creative{id}&access_token=${token}`
                            );

                            if (adResp.ok) {
                                const adData = await adResp.json();
                                const metaCreativeId = adData?.creative?.id;

                                // 3. Get high-res thumbnail using creative ID with dimensions
                                if (metaCreativeId) {
                                    const thumbResp = await fetch(
                                        `${META_API_BASE}/${metaCreativeId}?fields=thumbnail_url&thumbnail_width=1080&thumbnail_height=1080&access_token=${token}`
                                    );

                                    if (thumbResp.ok) {
                                        const thumbData = await thumbResp.json();
                                        if (thumbData?.thumbnail_url) {
                                            fullResUrl = thumbData.thumbnail_url;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // If we got a full-res URL, fetch it, cache to Supabase Storage, and return
                if (fullResUrl && creative) {
                    const imgResponse = await fetch(fullResUrl, {
                        headers: { "User-Agent": "Mozilla/5.0", "Accept": "image/*,*/*" },
                        redirect: "follow",
                    });

                    if (imgResponse.ok) {
                        const blob = await imgResponse.arrayBuffer();
                        if (blob.byteLength >= MIN_IMAGE_BYTES) {
                            const contentType = imgResponse.headers.get("content-type") || "image/jpeg";

                            // Cache to Supabase Storage for future direct access
                            const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
                            const storagePath = `${creative.company_id}/${creativeExternalId}.${ext}`;

                            try {
                                await supabase.storage.createBucket("creative-assets", {
                                    public: true,
                                    fileSizeLimit: 10485760,
                                }).catch(() => {});

                                const { error: uploadError } = await supabase.storage
                                    .from("creative-assets")
                                    .upload(storagePath, blob, { contentType, upsert: true });

                                if (!uploadError) {
                                    const { data: urlData } = supabase.storage
                                        .from("creative-assets")
                                        .getPublicUrl(storagePath);

                                    if (urlData?.publicUrl) {
                                        // Update DB so future loads skip the proxy entirely
                                        await supabase.from("creatives")
                                            .update({ image_url: urlData.publicUrl })
                                            .eq("id", creative.id);
                                    }
                                }
                            } catch (_) {
                                // Cache failed, but we still serve the image
                            }

                            return new Response(blob, {
                                headers: {
                                    ...corsHeaders,
                                    "Content-Type": contentType,
                                    "Cache-Control": "public, max-age=86400",
                                },
                            });
                        }
                    }
                }
            } catch (_) {
                // Fall through to direct fetch
            }
        }

        // Fallback: direct fetch of the original URL
        const response = await fetch(imageUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            },
            redirect: "follow",
        });

        if (!response.ok) {
            return new Response("Failed to fetch image", {
                status: 502,
                headers: corsHeaders,
            });
        }

        const contentType = response.headers.get("content-type") || "image/jpeg";
        const body = await response.arrayBuffer();

        if (body.byteLength < MIN_IMAGE_BYTES && creativeExternalId) {
            console.warn(`image-proxy: small payload (${body.byteLength}B) for ${creativeExternalId}, serving anyway`);
        }

        return new Response(body, {
            headers: {
                ...corsHeaders,
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400",
            },
        });
    } catch (err) {
        return new Response("Proxy error: " + (err as Error).message, {
            status: 500,
            headers: corsHeaders,
        });
    }
});
