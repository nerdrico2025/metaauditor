import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_API_VERSION = "v24.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdActionRequest {
    creative_id: string; // Internal ID
    action: 'pause' | 'activate' | 'preview';
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

        const body = await req.json() as AdActionRequest;
        const { creative_id, action } = body;

        if (!creative_id || !action) {
            throw new Error('Missing creative_id or action');
        }

        // Get ad and integration via campaign
        const { data: creative, error: creativeError } = await supabase
            .from('creatives')
            .select(`
                *, 
                campaigns (
                    integrations (
                        id, access_token, status
                    )
                )
            `)
            .eq('id', creative_id)
            .eq('company_id', userData.company_id)
            .single();

        if (creativeError || !creative) {
            throw new Error('Creative (Ad) not found');
        }

        const integration = creative.campaigns?.integrations;
        if (!integration || integration.status !== 'active') {
            throw new Error('No active integration found');
        }

        const accessToken = integration.access_token;
        const externalAdId = creative.external_id;

        if (!externalAdId) {
            throw new Error('Ad external ID not found');
        }

        let metaUrl = '';
        let metaMethod = 'POST';
        let metaBody: any = { access_token: accessToken };
        let dbUpdates: any = { updated_at: new Date().toISOString() };
        let syncType = `ad_${action}`;
        let responsePayload: any = {};

        switch (action) {
            case 'pause':
            case 'activate':
                metaUrl = `${META_API_BASE}/${externalAdId}`;
                metaBody.status = action === 'activate' ? 'ACTIVE' : 'PAUSED';
                dbUpdates.status = action === 'activate' ? 'active' : 'paused';
                break;

            case 'preview':
                // For preview we use GET and return the iframe
                metaUrl = `${META_API_BASE}/${externalAdId}/previews?ad_format=DESKTOP_FEED_STANDARD&access_token=${accessToken}`;
                metaMethod = 'GET';
                metaBody = null; // GET requests don't have body
                dbUpdates = null; // No DB update for preview
                syncType = 'ad_preview';
                break;

            default:
                throw new Error('Invalid action');
        }

        console.log(`Executing ${action} on ${externalAdId} via ${metaUrl}`);

        const fetchOptions: any = {
            method: metaMethod,
            headers: { 'Content-Type': 'application/json' }
        };

        if (metaBody) {
            fetchOptions.body = JSON.stringify(metaBody);
        }

        const metaResponse = await fetch(metaUrl, fetchOptions);

        if (!metaResponse.ok) {
            const errorData = await metaResponse.json();
            console.error('Meta API error:', errorData);
            throw new Error(`Failed to ${action} ad: ${errorData.error?.message || 'Unknown error'}`);
        }

        const responseData = await metaResponse.json();

        if (action === 'preview') {
            responsePayload.preview_content = responseData.data?.[0]?.body; // Meta returns HTML in body field of data list
        }

        // Update local database
        if (dbUpdates) {
            const { error: updateError } = await supabase
                .from('creatives')
                .update(dbUpdates)
                .eq('id', creative_id);

            if (updateError) {
                console.error('Database update error:', updateError);
            }
        }

        // Log the action (except preview to avoid spam)
        if (action !== 'preview') {
            await supabase.from('sync_history').insert({
                company_id: userData.company_id,
                integration_id: integration.id,
                sync_type: syncType,
                status: 'completed',
                records_synced: 1,
                details: {
                    creative_id,
                    external_id: externalAdId,
                    action,
                    meta_response: responseData
                },
            });
        }

        return new Response(
            JSON.stringify({
                success: true,
                creative_id,
                action,
                updates: dbUpdates,
                ...responsePayload
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('Ad action error:', error);
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
