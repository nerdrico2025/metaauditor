import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * fury-install-template
 * Activates a built-in rule template for the user's company.
 * Creates an automation_rule from the template with optional threshold overrides.
 *
 * POST body:
 *   template_id: string (e.g. 'saturation', 'high_cac')
 *   overrides?: { threshold?: number } — optional custom thresholds
 *
 * Also supports:
 *   action: 'list' — returns all templates + which ones are already installed
 *   action: 'uninstall', template_id — deactivates the rule from this template
 */
serve(async (req) => {
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

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();
        if (!userData?.company_id) throw new Error('User not associated with company');

        const companyId = userData.company_id;
        const body = await req.json();
        const action = body.action || 'install';

        // LIST: return all templates with installed status
        if (action === 'list') {
            const { data: templates } = await supabase
                .from('automation_rule_templates')
                .select('*')
                .order('id');

            const { data: installed } = await supabase
                .from('automation_rules')
                .select('template_id, id, status')
                .eq('company_id', companyId)
                .not('template_id', 'is', null);

            const installedMap = new Map((installed || []).map((r: any) => [r.template_id, r]));

            const result = (templates || []).map((t: any) => ({
                ...t,
                installed: installedMap.has(t.id),
                rule_id: installedMap.get(t.id)?.id || null,
                rule_status: installedMap.get(t.id)?.status || null,
            }));

            return new Response(JSON.stringify({ success: true, templates: result }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // UNINSTALL: deactivate rule from template
        if (action === 'uninstall') {
            const { template_id } = body;
            if (!template_id) throw new Error('Missing template_id');

            const { error: deleteError } = await supabase
                .from('automation_rules')
                .delete()
                .eq('company_id', companyId)
                .eq('template_id', template_id);

            if (deleteError) throw deleteError;

            return new Response(JSON.stringify({ success: true, message: 'Template uninstalled' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // INSTALL: create automation_rule from template
        const { template_id, overrides } = body;
        if (!template_id) throw new Error('Missing template_id');

        // Check if already installed
        const { data: existing } = await supabase
            .from('automation_rules')
            .select('id')
            .eq('company_id', companyId)
            .eq('template_id', template_id)
            .maybeSingle();

        if (existing) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Template already installed',
                rule_id: existing.id,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 409,
            });
        }

        // Fetch template
        const { data: template, error: tplError } = await supabase
            .from('automation_rule_templates')
            .select('*')
            .eq('id', template_id)
            .single();

        if (tplError || !template) throw new Error(`Template "${template_id}" not found`);

        // Build trigger_conditions with optional overrides
        const conditions = { ...template.trigger_conditions };
        if (overrides?.threshold != null) conditions.threshold = overrides.threshold;

        // Create the rule
        const { data: newRule, error: insertError } = await supabase
            .from('automation_rules')
            .insert({
                company_id: companyId,
                name: template.name,
                description: template.description,
                trigger_type: 'metric_threshold',
                trigger_conditions: conditions,
                action_type: template.action_type,
                applies_to: template.applies_to,
                evaluation_mode: conditions.mode || 'historical_avg',
                template_id: template.id,
                status: 'active',
                trigger_count: 0,
            })
            .select('id')
            .single();

        if (insertError) throw insertError;

        return new Response(JSON.stringify({
            success: true,
            message: `Template "${template.name}" installed`,
            rule_id: newRule.id,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('fury-install-template error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: String(error),
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
