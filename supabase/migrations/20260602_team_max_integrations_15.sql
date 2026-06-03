-- Product limit: up to 15 monitored Meta ad accounts per company (shared by the whole team).

UPDATE public.companies
SET max_integrations = 15,
    updated_at = now()
WHERE max_integrations IS NULL OR max_integrations < 15;

-- Enforce limit when enabling is_monitored on integrations
CREATE OR REPLACE FUNCTION public.enforce_integration_monitor_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max integer;
    v_current integer;
BEGIN
    IF NEW.is_monitored IS DISTINCT FROM true THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.is_monitored IS true THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(max_integrations, 15) INTO v_max
    FROM public.companies
    WHERE id = NEW.company_id;

    SELECT count(*)::integer INTO v_current
    FROM public.integrations
    WHERE company_id = NEW.company_id
      AND is_monitored = true
      AND id IS DISTINCT FROM NEW.id
      AND (platform IS NULL OR platform = 'meta');

    IF v_current >= v_max THEN
        RAISE EXCEPTION 'Limite de % contas de anúncio monitoradas atingido para esta organização.', v_max
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_integration_monitor_limit ON public.integrations;

CREATE TRIGGER trg_enforce_integration_monitor_limit
    BEFORE INSERT OR UPDATE OF is_monitored ON public.integrations
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_integration_monitor_limit();

-- New companies: max_integrations = 15 (was 3)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_company_id UUID;
    v_company_name TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
    v_role TEXT;
    v_slug TEXT;
    v_invited_company_id TEXT;
    v_invited_role TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
        RETURN NEW;
    END IF;

    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
    v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
    v_invited_company_id := NEW.raw_user_meta_data->>'invited_company_id';
    v_invited_role       := NEW.raw_user_meta_data->>'invited_role';

    IF v_invited_company_id IS NOT NULL AND v_invited_company_id <> '' THEN
        v_company_id := v_invited_company_id::UUID;
        v_role := COALESCE(NULLIF(v_invited_role, ''), 'operador');
    ELSE
        v_company_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_name', ''), 'Minha Empresa');

        v_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
        v_slug := regexp_replace(v_slug, '^-+|-+$', '', 'g');
        v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

        INSERT INTO public.companies (
            name, slug, status, subscription_plan,
            max_users, max_integrations, max_campaigns, max_audits_per_month,
            trial_ends_at, created_at, updated_at
        ) VALUES (
            v_company_name,
            v_slug,
            'trial',
            'free',
            6,
            15,
            20,
            50,
            now() + interval '14 days',
            now(),
            now()
        ) RETURNING id INTO v_company_id;

        v_role := 'company_admin';
    END IF;

    INSERT INTO public.users (
        id, email, first_name, last_name, company_id,
        role, is_active, password_hash, created_at, updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        v_first_name,
        v_last_name,
        v_company_id,
        v_role::user_role,
        true,
        'managed_by_supabase_auth',
        now(),
        now()
    );

    BEGIN
        INSERT INTO public.profiles (id, company_id)
        VALUES (NEW.id, v_company_id)
        ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id;
    EXCEPTION WHEN undefined_table THEN
        NULL;
    WHEN OTHERS THEN
        RAISE WARNING 'profiles sync failed for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
