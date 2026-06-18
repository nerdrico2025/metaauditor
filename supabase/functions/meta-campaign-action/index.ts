import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_API_VERSION = "v24.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignActionRequest {
    campaign_id: string;
    action: 'pause' | 'activate' | 'duplicate' | 'update_budget' | 'rename';
    payload?: {
        daily_budget?: number; // em centavos
        lifetime_budget?: number; // em centavos
        name?: string;
    };
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get auth header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        // Verify user
        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (authError || !user) {
            throw new Error('Unauthorized');
        }

        // Get user's company
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (userError || !userData?.company_id) {
            throw new Error('User not associated with company');
        }

        const body = await req.json() as CampaignActionRequest;
        const { campaign_id, action, payload } = body;

        if (!campaign_id || !action) {
            throw new Error('Missing campaign_id or action');
        }

        // Get campaign and integration
        const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .select('*, integrations(*)')
            .eq('id', campaign_id)
            .eq('company_id', userData.company_id)
            .single();

        if (campaignError || !campaign) {
            throw new Error('Campaign not found');
        }

        const integration = campaign.integrations;
        if (!integration || integration.status !== 'active') {
            throw new Error('No active integration found');
        }

        const accessToken = integration.access_token;
        const externalCampaignId = campaign.external_id;

        if (!externalCampaignId) {
            throw new Error('Campaign external ID not found');
        }

        let metaUrl = '';
        let metaMethod = 'POST';
        let metaBody: any = { access_token: accessToken };
        let dbUpdates: any = { updated_at: new Date().toISOString() };
        let syncType = `campaign_${action}`;
        let details: any = {};

        switch (action) {
            case 'pause':
            case 'activate':
                metaUrl = `${META_API_BASE}/${externalCampaignId}`;
                metaBody.status = action === 'activate' ? 'ACTIVE' : 'PAUSED';
                dbUpdates.status = action === 'activate' ? 'active' : 'paused';
                break;

            case 'update_budget':
                metaUrl = `${META_API_BASE}/${externalCampaignId}`;
                if (payload?.daily_budget) {
                    metaBody.daily_budget = payload.daily_budget; // Meta expects cents as string/number
                    dbUpdates.daily_budget = payload.daily_budget / 100;
                }
                if (payload?.lifetime_budget) {
                    metaBody.lifetime_budget = payload.lifetime_budget;
                    dbUpdates.lifetime_budget = payload.lifetime_budget / 100;
                }
                if (!payload?.daily_budget && !payload?.lifetime_budget) {
                    throw new Error('Missing budget value in payload');
                }
                details.new_budget = payload.daily_budget || payload.lifetime_budget;
                break;

            case 'rename':
                metaUrl = `${META_API_BASE}/${externalCampaignId}`;
                if (!payload?.name) throw new Error('Missing name in payload');
                metaBody.name = payload.name;
                dbUpdates.name = payload.name;
                details.new_name = payload.name;
                break;

            case 'duplicate':
                metaUrl = `${META_API_BASE}/${externalCampaignId}/copies`;
                metaBody.status_option = 'PAUSED'; // Default to paused copy
                // Handle different rename strategies if needed
                if (payload?.name) {
                    // Note: Rename options format might differ, standard copy usually appends 'Copy'
                    // For simplicity we let Meta handle naming or update it after
                    // According to docs: rename_options parameter
                }
                // Duplicate doesn't update the original campaign in DB
                dbUpdates = null;
                syncType = 'campaign_duplicated';
                break;

            default:
                throw new Error('Invalid action');
        }

        console.log(`Executing ${action} on ${externalCampaignId} via ${metaUrl}`);

        const metaResponse = await fetch(metaUrl, {
            method: metaMethod,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(metaBody),
        });

        if (!metaResponse.ok) {
            const errorData = await metaResponse.json();
            console.error('Meta API error:', errorData);
            throw new Error(`Failed to ${action} campaign: ${errorData.error?.message || 'Unknown error'}`);
        }

        const responseData = await metaResponse.json();

        // If duplicate, receive new ID
        if (action === 'duplicate' && responseData.id) {
            // In a real scenario, we should fetch the new campaign info and insert into DB
            // For now, next sync cycle will pick it up, or we can trigger sync-meta-data
            details.new_campaign_id = responseData.id;
        }

        // Update local database if applicable
        if (dbUpdates) {
            const { error: updateError } = await supabase
                .from('campaigns')
                .update(dbUpdates)
                .eq('id', campaign_id);

            if (updateError) {
                console.error('Database update error:', updateError);
                // Don't throw - Meta update succeeded
            }
        }

        // Log the action
        await supabase.from('sync_history').insert({
            company_id: userData.company_id,
            integration_id: integration.id,
            sync_type: syncType,
            status: 'completed',
            records_synced: 1,
            details: {
                campaign_id,
                external_id: externalCampaignId,
                action,
                meta_response: responseData,
                ...details
            },
        });

        return new Response(
            JSON.stringify({
                success: true,
                campaign_id,
                action,
                updates: dbUpdates,
                meta_response: responseData
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('Campaign action error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: String(error),
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
