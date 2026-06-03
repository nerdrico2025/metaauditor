import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_API_VERSION = "v24.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateCampaignRequest {
    integration_id: string;
    campaign: {
        name: string;
        objective: string;
        status: string;
        special_ad_categories?: string[];
    };
    adset: {
        name: string;
        daily_budget?: number; // em centavos
        lifetime_budget?: number; // em centavos
        start_time: string;
        end_time?: string;
        billing_event: string;
        optimization_goal: string;
        targeting: any;
    };
    ad: {
        name: string;
        creative: {
            title: string;
            body: string;
            image_url?: string;
            image_hash?: string;
            link_url: string;
            call_to_action: string;
            page_id: string;
            instagram_actor_id?: string;
        };
    };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }


    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing authorization header');

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (authError || !user) throw new Error('Unauthorized');

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (userError || !userData?.company_id) throw new Error('User company not found');

        const payload = await req.json() as CreateCampaignRequest;
        const { integration_id, campaign, adset, ad } = payload;

        // 1. Get Integration Token
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('*')
            .eq('id', integration_id)
            .eq('company_id', userData.company_id)
            .single();

        if (intError || !integration) throw new Error('Integration not found');
        const accessToken = integration.access_token;
        const accountId = integration.account_id;

        // Helper for Meta API calls
        const metaRequest = async (endpoint: string, method: string, body: any) => {
            const url = `${META_API_BASE}/${endpoint}`;
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, access_token: accessToken })
            });
            const data = await response.json();
            if (!response.ok) {
                console.error(`Meta API Error (${endpoint}):`, data);
                throw new Error(data.error?.message || 'Meta API request failed');
            }
            return data;
        };

        // 2. Create Campaign
        console.log('Creating campaign...');
        const campaignData = await metaRequest(`act_${accountId}/campaigns`, 'POST', {
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            special_ad_categories: campaign.special_ad_categories && campaign.special_ad_categories.length > 0
                ? campaign.special_ad_categories
                : ['NONE'],
        });
        const campaignId = campaignData.id;

        try {
            // 3. Create Ad Set
            console.log(`Creating ad set for campaign ${campaignId}...`);
            const adSetData = await metaRequest(`act_${accountId}/adsets`, 'POST', {
                name: adset.name,
                campaign_id: campaignId,
                daily_budget: adset.daily_budget, // Meta expects cents as string/number
                lifetime_budget: adset.lifetime_budget,
                start_time: adset.start_time,
                billing_event: adset.billing_event,
                optimization_goal: adset.optimization_goal,
                targeting: adset.targeting,
                status: campaign.status,
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP', // Simplified for V1
            });
            const adSetId = adSetData.id;

            // 4. Create Ad Creative
            console.log(`Creating ad creative...`);

            // Simplified Image Hash Logic: If URL provided, fetch and hash? Or assume frontend sends hash?
            // For V1, we assume URL is public or hash is provided. Meta supports image_url in object_story_spec for link ads.
            const creativePayload = {
                name: `${ad.name} - Creative`,
                object_story_spec: {
                    page_id: ad.creative.page_id,
                    instagram_actor_id: ad.creative.instagram_actor_id, // Optional
                    link_data: {
                        call_to_action: {
                            type: ad.creative.call_to_action,
                            value: { link: ad.creative.link_url }
                        },
                        link: ad.creative.link_url,
                        message: ad.creative.body, // Text
                        name: ad.creative.title, // Headline
                        picture: ad.creative.image_url, // For link ads
                        image_hash: ad.creative.image_hash
                    }
                }
            };

            const creativeData = await metaRequest(`act_${accountId}/adcreatives`, 'POST', creativePayload);
            const creativeId = creativeData.id;

            // 5. Create Ad
            console.log(`Creating ad...`);
            const adData = await metaRequest(`act_${accountId}/ads`, 'POST', {
                name: ad.name,
                adset_id: adSetId,
                creative: { creative_id: creativeId },
                status: campaign.status
            });
            const adId = adData.id;

            // 6. Log success to DB
            await supabase.from('sync_history').insert({
                company_id: userData.company_id,
                integration_id: integration.id,
                sync_type: 'campaign_created',
                status: 'completed',
                records_synced: 1,
                details: { campaignId, adSetId, adId }
            });

            return new Response(JSON.stringify({
                success: true,
                campaign_id: campaignId,
                adset_id: adSetId,
                ad_id: adId
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });

        } catch (error) {
            console.error('Error in creation chain, attempting rollback (deleting campaign)...', error);
            // Rollback: Delete the campaign (which cascades deletes adset/ads)
            try {
                await metaRequest(campaignId, 'DELETE', {});
                console.log('Rollback successful: Campaign deleted.');
            } catch (delError) {
                console.error('Failed to rollback campaign:', delError);
            }
            throw error; // Re-throw to be caught by main catch
        }

    } catch (error) {
        console.error('Create campaign error:', error);
        return new Response(JSON.stringify({ error: String(error) }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
