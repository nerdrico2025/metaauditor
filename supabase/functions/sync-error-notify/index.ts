// Phase D3 (briefing #10): scans `sync_errors` for unnotified rows and sends
// alerts to the platform admin (Rafael). Designed to be invoked by pg_cron
// every hour, OR by a Postgres trigger that fires after sync_errors inserts.
//
// Channels:
//   - email via Resend (RESEND_API_KEY)
//   - WhatsApp via Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)
//
// Required env (set via `supabase secrets set ...`):
//   ADMIN_ALERT_EMAIL=rafael@clickhero...    # required to send email
//   ADMIN_ALERT_WHATSAPP=+5511...            # optional, sends WhatsApp if set
//   RESEND_API_KEY=...                       # required for email
//   TWILIO_ACCOUNT_SID=...                   # required for WhatsApp
//   TWILIO_AUTH_TOKEN=...
//   TWILIO_WHATSAPP_FROM=whatsapp:+1...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/resend.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncErrorRow {
    id: string;
    integration_id: string | null;
    company_id: string | null;
    error_message: string;
    error_code: string | null;
    failed_at: string;
}

async function sendWhatsapp(to: string, message: string): Promise<boolean> {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const token = Deno.env.get('TWILIO_AUTH_TOKEN');
    const from = Deno.env.get('TWILIO_WHATSAPP_FROM');
    if (!sid || !token || !from) return false;
    const auth = btoa(`${sid}:${token}`);
    const body = new URLSearchParams({
        From: from,
        To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        Body: message,
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });
    if (!res.ok) {
        console.error('Twilio failed', await res.text());
        return false;
    }
    return true;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: pending, error } = await supabase
            .from('sync_errors')
            .select('*')
            .eq('notified', false)
            .order('failed_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        const rows = (pending ?? []) as SyncErrorRow[];
        if (rows.length === 0) {
            return new Response(JSON.stringify({ success: true, sent: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const adminEmail = Deno.env.get('ADMIN_ALERT_EMAIL');
        const adminWa = Deno.env.get('ADMIN_ALERT_WHATSAPP');

        const summary = rows
            .map(r => `• ${r.failed_at} — integration ${r.integration_id ?? '?'} :: ${r.error_message}`)
            .join('\n');
        const subject = `[Click Auditor] ${rows.length} falha(s) de sincronização Meta`;
        const body = `Detectamos ${rows.length} falha(s) recentes na sincronização automática.\n\n${summary}\n\nVerifique o painel de integrações.`;

        let emailOk = false, waOk = false;
        if (adminEmail) emailOk = await sendEmail(adminEmail, subject, body);
        if (adminWa) waOk = await sendWhatsapp(adminWa, `[Click Auditor] ${rows.length} falha(s) de sync.\n\n${summary.slice(0, 1000)}`);

        if (emailOk || waOk) {
            const ids = rows.map(r => r.id);
            await supabase
                .from('sync_errors')
                .update({ notified: true, notified_at: new Date().toISOString() })
                .in('id', ids);
        }

        return new Response(JSON.stringify({
            success: true,
            sent: rows.length,
            channels: { email: emailOk, whatsapp: waOk },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ success: false, error: message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
