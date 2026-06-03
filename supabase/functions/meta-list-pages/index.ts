import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_API_VERSION = "v24.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

        const { integration_id } = await req.json();
        if (!integration_id) throw new Error('Missing integration_id');

        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('access_token')
            .eq('id', integration_id)
            .single();

        if (intError || !integration) throw new Error('Integration not found');

        // Fetch Pages
        // access_token should be a User Access Token with 'pages_show_list' permission
        const url = `${META_API_BASE}/me/accounts?fields=id,name,access_token,picture&access_token=${integration.access_token}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('Meta API Error (Pages):', data);
            throw new Error(data.error?.message || 'Failed to list pages');
        }

        return new Response(JSON.stringify({ pages: data.data || [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('List pages error:', error);
        return new Response(JSON.stringify({ error: String(error) }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
