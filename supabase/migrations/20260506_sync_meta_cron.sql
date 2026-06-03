-- Automatic recurring sync for all monitored Meta integrations.
-- Without this, sync only runs when the user clicks "Sincronizar" on /integracoes,
-- which lets accounts drift for days (FIBRA 4 was never synced; FIBRA 6 had stale
-- data from 14 days back when this was discovered).
--
-- Strategy: pg_cron triggers a PL/pgSQL function that iterates over monitored
-- integrations and fires off async net.http_post calls (one per integration) to
-- the sync-meta-data Edge Function. pg_net is non-blocking so the cron job
-- returns immediately while syncs run in parallel server-side.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_meta_sync_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    integ record;
    fn_url text := 'https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/sync-meta-data';
    -- Anon key (public — already exposed in the frontend bundle). Edge Functions
    -- require a valid token in the Authorization header for the gateway to
    -- route the request, but sync-meta-data does not validate the JWT itself
    -- (it uses service_role internally). Using the anon key here avoids
    -- embedding the service_role secret in pg_proc.
    auth_header text := 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqeGxoc3Rvc2Rycnl6cm1mc2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEwMDksImV4cCI6MjA4NTIzNzAwOX0.sMwRQmKi6VRYxsrRKJzWzum6zGM36f2ATqViYjHj-Ik';
BEGIN
    FOR integ IN
        SELECT id
        FROM integrations
        WHERE platform = 'meta'
          AND status = 'active'
          AND is_monitored = true
    LOOP
        PERFORM net.http_post(
            url := fn_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', auth_header
            ),
            body := jsonb_build_object(
                'integration_id', integ.id,
                'sync_type', 'metrics_only'
            )
        );
    END LOOP;
END;
$$;

-- Unschedule any prior version so this migration is idempotent.
DO $$
BEGIN
    PERFORM cron.unschedule('sync-meta-hourly');
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

-- Every 3 hours. Each integration takes ~60-140s; running every 3h keeps
-- dashboard data fresh without piling load on Meta's API.
SELECT cron.schedule(
    'sync-meta-hourly',
    '0 */3 * * *',
    $$ SELECT public.trigger_meta_sync_all(); $$
);
