-- Team limit: 1 owner (company_admin) + up to 5 invited members = 6 active users max

-- Backfill existing companies that still use the old default of 5
UPDATE public.companies
SET max_users = 6,
    updated_at = now()
WHERE max_users IS NULL OR max_users <= 5;

-- Update handle_new_user to provision new companies with max_users = 6
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
            3,
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
