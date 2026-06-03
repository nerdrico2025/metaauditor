import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_API_VERSION = "v24.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdSetActionRequest {
    adset_id: string;
    action: 'pause' | 'activate' | 'update_budget';
    payload?: {
        daily_budget?: number; // em centavos
        lifetime_budget?: number; // em centavos
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

        const body = await req.json() as AdSetActionRequest;
        const { adset_id, action, payload } = body;

        if (!adset_id || !action) {
            throw new Error('Missing adset_id or action');
        }

        // Get adset and integration via campaign
        const { data: adSet, error: adSetError } = await supabase
            .from('ad_sets')
            .select(`
                *, 
                campaigns (
                    integrations (
                        id, access_token, status
                    )
                )
            `)
            .eq('id', adset_id)
            .eq('company_id', userData.company_id)
            .single();

        if (adSetError || !adSet) {
            throw new Error('Ad Set not found');
        }

        const integration = adSet.campaigns?.integrations;
        if (!integration || integration.status !== 'active') {
            throw new Error('No active integration found');
        }

        const accessToken = integration.access_token;
        const externalAdSetId = adSet.external_id;

        if (!externalAdSetId) {
            throw new Error('Ad Set external ID not found');
        }

        let metaUrl = `${META_API_BASE}/${externalAdSetId}`;
        let metaBody: any = { access_token: accessToken };
        let dbUpdates: any = { updated_at: new Date().toISOString() };
        let syncType = `adset_${action}`;

        switch (action) {
            case 'pause':
            case 'activate':
                metaBody.status = action === 'activate' ? 'ACTIVE' : 'PAUSED';
                dbUpdates.status = action === 'activate' ? 'active' : 'paused';
                break;

            case 'update_budget':
                if (payload?.daily_budget) {
                    metaBody.daily_budget = payload.daily_budget;
                    dbUpdates.daily_budget = payload.daily_budget / 100;
                }
                if (payload?.lifetime_budget) {
                    metaBody.lifetime_budget = payload.lifetime_budget;
                    dbUpdates.lifetime_budget = payload.lifetime_budget / 100;
                }
                if (!payload?.daily_budget && !payload?.lifetime_budget) {
                    throw new Error('Missing budget value in payload');
                }
                break;

            default:
                throw new Error('Invalid action');
        }

        console.log(`Executing ${action} on ${externalAdSetId} via ${metaUrl}`);

        const metaResponse = await fetch(metaUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(metaBody),
        });

        if (!metaResponse.ok) {
            const errorData = await metaResponse.json();
            console.error('Meta API error:', errorData);
            throw new Error(`Failed to ${action} ad set: ${errorData.error?.message || 'Unknown error'}`);
        }

        const responseData = await metaResponse.json();

        // Update local database
        const { error: updateError } = await supabase
            .from('ad_sets')
            .update(dbUpdates)
            .eq('id', adset_id);

        if (updateError) {
            console.error('Database update error:', updateError);
        }

        // Log the action
        await supabase.from('sync_history').insert({
            company_id: userData.company_id,
            integration_id: integration.id,
            sync_type: syncType,
            status: 'completed',
            records_synced: 1,
            details: {
                adset_id,
                external_id: externalAdSetId,
                action,
                meta_response: responseData,
                db_updates: dbUpdates
            },
        });

        return new Response(
            JSON.stringify({
                success: true,
                adset_id,
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
        console.error('Ad Set action error:', error);
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
