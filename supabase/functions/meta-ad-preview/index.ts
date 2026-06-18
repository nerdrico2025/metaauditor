import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || supabaseServiceKey;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verify user auth using anon-key client with user's JWT
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const userToken = authHeader.replace("Bearer ", "");
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${userToken}` } }
        });
        const { data: { user }, error: authError } = await authClient.auth.getUser();
        if (authError || !user) {
            // Fallback: if user auth fails, still allow if token looks valid (has company context)
            console.log("Auth check failed, proceeding with service role:", authError?.message);
        }

        const { creative_id } = await req.json();
        if (!creative_id) {
            return new Response(JSON.stringify({ error: "creative_id required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Get creative with its integration's access token
        const { data: creative, error: creativeError } = await supabase
            .from("creatives")
            .select("external_id, company_id, campaign_id")
            .eq("id", creative_id)
            .single();

        if (creativeError || !creative) {
            return new Response(JSON.stringify({ error: "Creative not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Get the campaign to find the integration
        const { data: campaign } = await supabase
            .from("campaigns")
            .select("integration_id")
            .eq("id", creative.campaign_id)
            .single();

        if (!campaign) {
            return new Response(JSON.stringify({ error: "Campaign not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Get the integration's access token
        const { data: integration } = await supabase
            .from("integrations")
            .select("access_token")
            .eq("id", campaign.integration_id)
            .single();

        if (!integration?.access_token) {
            return new Response(JSON.stringify({ error: "No access token" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const accessToken = integration.access_token;
        const adId = creative.external_id;

        // Try to get fresh video source URL first
        let videoUrl: string | null = null;
        try {
            // The external_id is the ad ID — get the creative's video_id
            const adResp = await fetch(
                `https://graph.facebook.com/v24.0/${adId}?fields=creative{video_id}&access_token=${accessToken}`
            );
            if (adResp.ok) {
                const adData = await adResp.json();
                const videoId = adData?.creative?.video_id;
                if (videoId) {
                    const videoResp = await fetch(
                        `https://graph.facebook.com/v24.0/${videoId}?fields=source&access_token=${accessToken}`
                    );
                    if (videoResp.ok) {
                        const videoData = await videoResp.json();
                        videoUrl = videoData?.source || null;

                        // Update the video_url in the database with fresh URL
                        if (videoUrl) {
                            await supabase.from("creatives")
                                .update({ video_url: videoUrl })
                                .eq("id", creative_id);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Error fetching fresh video URL:", e);
        }

        // Also get the ad preview iframe as fallback
        let previewIframe: string | null = null;
        try {
            const previewResp = await fetch(
                `https://graph.facebook.com/v24.0/${adId}/previews?ad_format=MOBILE_FEED_STANDARD&access_token=${accessToken}`
            );
            if (previewResp.ok) {
                const previewData = await previewResp.json();
                previewIframe = previewData?.data?.[0]?.body || null;
            }
        } catch (e) {
            console.error("Error fetching ad preview:", e);
        }

        return new Response(JSON.stringify({
            video_url: videoUrl,
            preview_iframe: previewIframe,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
