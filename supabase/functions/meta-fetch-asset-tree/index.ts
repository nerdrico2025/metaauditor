import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: req.headers.get("Authorization")! },
                },
            }
        );

        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }

        const { integrationId } = await req.json();

        if (!integrationId) {
            return new Response(JSON.stringify({ error: "Missing integrationId parameter" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        // Initialize Supabase admin client to bypass RLS for fetching integration tokens securely
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

        if (!accessToken || !accountId) {
            return new Response(JSON.stringify({ error: "Missing access token or account ID" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        console.log(`Fetching asset tree for account ${accountId}`);

        // Fetch Campaigns
        const campaignsUrl = `https://graph.facebook.com/v24.0/act_${accountId}/campaigns?fields=id,name,status&limit=100&access_token=${accessToken}`;
        const campaignsResponse = await fetch(campaignsUrl);

        if (!campaignsResponse.ok) {
            const errorData = await campaignsResponse.json();
            console.error("Meta API Error fetching campaigns:", errorData);
            throw new Error("Failed to fetch campaigns from Meta");
        }
        const campaignsData = await campaignsResponse.json();

        // Fetch Ad Sets
        const adSetsUrl = `https://graph.facebook.com/v24.0/act_${accountId}/adsets?fields=id,name,campaign_id,status&limit=500&access_token=${accessToken}`;
        const adSetsResponse = await fetch(adSetsUrl);
        const adSetsData = await adSetsResponse.json();

        // Fetch Ads (Creatives)
        const adsUrl = `https://graph.facebook.com/v24.0/act_${accountId}/ads?fields=id,name,campaign_id,adset_id,status,creative&limit=500&access_token=${accessToken}`;
        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();

        // Organize into a tree structure
        const tree = campaignsData.data.map((campaign: any) => {
            const campaignAdSets = (adSetsData.data || []).filter((adset: any) => adset.campaign_id === campaign.id);

            const adsetsWithAds = campaignAdSets.map((adset: any) => {
                const adsetAds = (adsData.data || []).filter((ad: any) => ad.adset_id === adset.id);
                return {
                    id: adset.id,
                    name: adset.name,
                    status: adset.status,
                    creatives: adsetAds.map((ad: any) => ({
                        id: ad.id,
                        name: ad.name,
                        status: ad.status,
                        creative_id: ad.creative?.id
                    }))
                }
            });

            return {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                adsets: adsetsWithAds,
                // A flat list of creatives for this campaign for easier checkbox selection
                creatives: (adsData.data || [])
                    .filter((ad: any) => ad.campaign_id === campaign.id)
                    .map((ad: any) => ({
                        id: ad.id,
                        name: ad.name,
                        status: ad.status,
                        creative_id: ad.creative?.id
                    }))
            };
        });

        return new Response(JSON.stringify({
            success: true,
            account: { id: accountId, name: integration.account_name },
            campaigns: tree
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Error fetching asset tree:", error);
        return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
