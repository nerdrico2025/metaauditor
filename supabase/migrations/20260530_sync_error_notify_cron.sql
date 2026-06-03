-- Phase D3 (briefing #10): schedule the sync-error-notify worker.
-- Every hour at :15 it scans `sync_errors` for unnotified rows and alerts the
-- admin (email via Resend / WhatsApp via Twilio). Alerts stay inert until the
-- RESEND_API_KEY / ADMIN_ALERT_EMAIL (and optional Twilio) secrets are set.
--
-- Mirrors the pattern in 20260506_sync_meta_cron.sql: pg_cron fires an async
-- non-blocking net.http_post to the Edge Function. The anon key is the same
-- public token already used there (the gateway needs a valid JWT to route;
-- the function uses service_role internally).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Unschedule any prior version so this migration is idempotent.
DO $$
BEGIN
    PERFORM cron.unschedule('sync-error-alerts');
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

SELECT cron.schedule(
    'sync-error-alerts',
    '15 * * * *',
    $$ SELECT net.http_post(
        url := 'https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/sync-error-notify',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqeGxoc3Rvc2Rycnl6cm1mc2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEwMDksImV4cCI6MjA4NTIzNzAwOX0.sMwRQmKi6VRYxsrRKJzWzum6zGM36f2ATqViYjHj-Ik'
        ),
        body := '{}'::jsonb
    ); $$
);
