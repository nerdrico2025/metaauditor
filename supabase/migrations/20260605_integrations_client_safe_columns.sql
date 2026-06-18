-- Defense in depth: authenticated clients must not read OAuth tokens via REST.
-- Frontend uses INTEGRATION_PUBLIC_COLUMNS; this migration blocks column-level leaks.

CREATE OR REPLACE VIEW public.integrations_client
WITH (security_invoker = true)
AS
SELECT
  id,
  company_id,
  platform,
  account_id,
  account_name,
  status,
  last_sync_at,
  token_expires_at,
  permissions,
  user_id,
  created_at,
  updated_at,
  is_monitored,
  sync_preferences
FROM public.integrations;

GRANT SELECT ON public.integrations_client TO authenticated;
GRANT SELECT ON public.integrations_client TO anon;

REVOKE SELECT (access_token, refresh_token) ON public.integrations FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.integrations FROM anon;

COMMENT ON VIEW public.integrations_client IS
  'Client-safe integration rows without OAuth tokens. Prefer this view or explicit column lists in the browser.';
