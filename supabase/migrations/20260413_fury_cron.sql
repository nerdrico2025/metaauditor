-- FURY v0 Phase 3: Hourly cron for automated rule evaluation
-- Requires pg_cron and pg_net extensions (enabled in project)

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule: evaluate performance rules every hour for all companies
-- Uses service role key to bypass JWT verification (cron mode)
SELECT cron.schedule(
    'fury-hourly-eval',
    '0 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/evaluate-performance-rules',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqeGxoc3Rvc2Rycnl6cm1mc2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTAwOSwiZXhwIjoyMDg1MjM3MDA5fQ.5QufE_HepUm3JGNbub053c5j-jgjjLrtTYQPXJDIHN0'
        ),
        body := '{"cron": true}'::jsonb
    );
    $$
);
