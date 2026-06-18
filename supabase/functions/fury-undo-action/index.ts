import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_API_BASE = 'https://graph.facebook.com/v24.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * fury-undo-action
 * Reverts a FURY action within the 30-minute undo window.
 * Reads old state from fury_actions.action_config and calls Meta API to restore it.
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Auth
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

        const { action_id } = await req.json();
        if (!action_id) throw new Error('Missing action_id');

        // Fetch the fury action
        const { data: action, error: actionError } = await supabase
            .from('fury_actions')
            .select('*')
            .eq('id', action_id)
            .eq('company_id', userData.company_id)
            .single();

        if (actionError || !action) throw new Error('Action not found');
        if (action.status === 'undone') throw new Error('Action already undone');
        if (action.status === 'failed') throw new Error('Cannot undo a failed action');

        // Check undo deadline
        if (action.undo_deadline && new Date(action.undo_deadline) < new Date()) {
            throw new Error('Undo window expired (30 minutes)');
        }

        const config = action.action_config || {};
        let undoSuccess = false;
        let undoMessage = '';

        // Get integration token for Meta API calls
        let accessToken: string | null = null;
        if (action.entity_external_id) {
            // Find integration via the entity
            const entityTable = action.entity_type === 'campaign' ? 'campaigns'
                : action.entity_type === 'adset' ? 'ad_sets'
                : 'creatives';

            const { data: entity } = await supabase
                .from(entityTable)
                .select('integration_id')
                .eq('id', action.entity_id)
                .single();

            if (entity?.integration_id) {
                const { data: integration } = await supabase
                    .from('integrations')
                    .select('access_token')
                    .eq('id', entity.integration_id)
                    .single();
                accessToken = integration?.access_token || null;
            }
        }

        // Revert based on action type
        switch (action.action_type) {
            case 'pause': {
                // Undo pause → reactivate
                if (!action.entity_external_id || !accessToken) {
                    undoMessage = 'Cannot undo: missing external ID or token';
                    break;
                }
                const oldStatus = config.old_status || 'ACTIVE';
                const token = encodeURIComponent(accessToken);
                const resp = await fetch(
                    `${META_API_BASE}/${action.entity_external_id}?status=${oldStatus}&access_token=${token}`,
                    { method: 'POST' }
                );
                if (resp.ok) {
                    // Update local status
                    const table = action.entity_type === 'campaign' ? 'campaigns'
                        : action.entity_type === 'adset' ? 'ad_sets'
                        : 'creatives';
                    await supabase
                        .from(table)
                        .update({ status: oldStatus.toLowerCase() })
                        .eq('id', action.entity_id);
                    undoSuccess = true;
                    undoMessage = `Restored to ${oldStatus}`;
                } else {
                    const err = await resp.json().catch(() => ({}));
                    undoMessage = `Meta API error: ${err?.error?.message || resp.statusText}`;
                }
                break;
            }
            case 'activate': {
                // Undo activate → pause back
                if (!action.entity_external_id || !accessToken) {
                    undoMessage = 'Cannot undo: missing external ID or token';
                    break;
                }
                const oldStatus = config.old_status || 'PAUSED';
                const token = encodeURIComponent(accessToken);
                const resp = await fetch(
                    `${META_API_BASE}/${action.entity_external_id}?status=${oldStatus}&access_token=${token}`,
                    { method: 'POST' }
                );
                if (resp.ok) {
                    const table = action.entity_type === 'campaign' ? 'campaigns'
                        : action.entity_type === 'adset' ? 'ad_sets'
                        : 'creatives';
                    await supabase
                        .from(table)
                        .update({ status: oldStatus.toLowerCase() })
                        .eq('id', action.entity_id);
                    undoSuccess = true;
                    undoMessage = `Restored to ${oldStatus}`;
                } else {
                    const err = await resp.json().catch(() => ({}));
                    undoMessage = `Meta API error: ${err?.error?.message || resp.statusText}`;
                }
                break;
            }
            case 'update_budget': {
                // Undo budget change → restore old budget
                if (!action.entity_external_id || !accessToken || !config.old_budget) {
                    undoMessage = 'Cannot undo: missing external ID, token, or old budget';
                    break;
                }
                const token = encodeURIComponent(accessToken);
                const budgetCentavos = Math.round(config.old_budget * 100);
                const resp = await fetch(
                    `${META_API_BASE}/${action.entity_external_id}?daily_budget=${budgetCentavos}&access_token=${token}`,
                    { method: 'POST' }
                );
                if (resp.ok) {
                    const table = action.entity_type === 'campaign' ? 'campaigns' : 'ad_sets';
                    await supabase
                        .from(table)
                        .update({ daily_budget: config.old_budget })
                        .eq('id', action.entity_id);
                    undoSuccess = true;
                    undoMessage = `Budget restored to ${config.old_budget}`;
                } else {
                    const err = await resp.json().catch(() => ({}));
                    undoMessage = `Meta API error: ${err?.error?.message || resp.statusText}`;
                }
                break;
            }
            case 'notify':
            case 'flag_review': {
                // These are non-destructive — just mark as undone
                undoSuccess = true;
                undoMessage = 'Notification dismissed';
                break;
            }
            default:
                undoMessage = `Unknown action type: ${action.action_type}`;
        }

        // Update fury_actions record
        await supabase
            .from('fury_actions')
            .update({
                status: undoSuccess ? 'undone' : 'failed',
                undone_at: undoSuccess ? new Date().toISOString() : null,
                action_config: { ...config, undo_result: undoMessage },
            })
            .eq('id', action_id);

        return new Response(JSON.stringify({
            success: undoSuccess,
            message: undoMessage,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: undoSuccess ? 200 : 400,
        });

    } catch (error) {
        console.error('fury-undo-action error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: String(error),
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
