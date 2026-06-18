-- ═══════════════════════════════════════════════════════════════════════════
-- AUTO-PROVISION: Company + User on signup
-- Creates an isolated company for each new registration.
-- Invited users join an existing company instead.
-- Run this in Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Trigger function: handle_new_user
-- ─────────────────────────────────────────────────────────────────────────
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
    -- Idempotency: skip if user row already exists
    IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- Extract metadata from auth signup
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
    v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
    v_invited_company_id := NEW.raw_user_meta_data->>'invited_company_id';
    v_invited_role       := NEW.raw_user_meta_data->>'invited_role';

    IF v_invited_company_id IS NOT NULL AND v_invited_company_id <> '' THEN
        -- ═══ INVITED USER: join existing company ═══
        v_company_id := v_invited_company_id::UUID;
        v_role := COALESCE(NULLIF(v_invited_role, ''), 'operador');
    ELSE
        -- ═══ SELF-REGISTRATION: create new isolated company ═══
        v_company_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_name', ''), 'Minha Empresa');

        -- Generate unique slug: slugified-name-XXXX
        v_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
        v_slug := regexp_replace(v_slug, '^-+|-+$', '', 'g'); -- trim leading/trailing dashes
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
            5,    -- max_users
            3,    -- max_integrations
            20,   -- max_campaigns
            50,   -- max_audits_per_month
            now() + interval '14 days',
            now(),
            now()
        ) RETURNING id INTO v_company_id;

        v_role := 'company_admin';
    END IF;

    -- Create public.users record
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

    -- Sync to profiles table (backward compat for ad_set_metrics RLS policies)
    -- Uses ON CONFLICT to handle both insert and update cases safely
    BEGIN
        INSERT INTO public.profiles (id, company_id)
        VALUES (NEW.id, v_company_id)
        ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id;
    EXCEPTION WHEN undefined_table THEN
        -- profiles table doesn't exist — skip silently
        NULL;
    WHEN OTHERS THEN
        -- Non-critical: don't block signup if profiles sync fails
        RAISE WARNING 'profiles sync failed for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- Never block auth signup — log and continue
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Create trigger on auth.users
-- ─────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Refresh PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
