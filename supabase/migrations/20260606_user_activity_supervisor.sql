-- Platform supervisor activity tracking (MVP)
-- Allowlist: filipesenna59@gmail.com, denilson.oliveira@clickhero.com, rafael@clickhero.com.br

CREATE OR REPLACE FUNCTION public.is_platform_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()::text
      AND lower(trim(u.email)) IN (
        'filipesenna59@gmail.com',
        'denilson.oliveira@clickhero.com',
        'rafael@clickhero.com.br'
      )
  );
$$;

CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id uuid NULL REFERENCES public.companies(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('login', 'logout', 'page_view', 'action')),
  action text NULL,
  path text NULL,
  resource_type text NULL,
  resource_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_events_user_created
  ON public.user_activity_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_events_company_created
  ON public.user_activity_events (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_events_created
  ON public.user_activity_events (created_at DESC);

ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own activity events" ON public.user_activity_events;
CREATE POLICY "Users insert own activity events"
  ON public.user_activity_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()::text
    AND (
      company_id IS NULL
      OR company_id IN (
        SELECT u.company_id
        FROM public.users u
        WHERE u.id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "Platform supervisors read activity events" ON public.user_activity_events;
CREATE POLICY "Platform supervisors read activity events"
  ON public.user_activity_events
  FOR SELECT
  TO authenticated
  USING (public.is_platform_supervisor());

-- Cross-tenant read for supervisor dashboard (safe if RLS already exists on users/companies)
DROP POLICY IF EXISTS "Platform supervisors read all users" ON public.users;
CREATE POLICY "Platform supervisors read all users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (public.is_platform_supervisor());

DROP POLICY IF EXISTS "Platform supervisors read all companies" ON public.companies;
CREATE POLICY "Platform supervisors read all companies"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (public.is_platform_supervisor());

-- Allow users to update their own last_login_at on sign-in
DROP POLICY IF EXISTS "Users update own last login" ON public.users;
CREATE POLICY "Users update own last login"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);
