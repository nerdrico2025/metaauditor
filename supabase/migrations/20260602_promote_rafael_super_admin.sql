-- Promote Rafael Cruz to platform super_admin.
-- If 0 rows updated, the user has not registered yet — re-run after first login.

UPDATE public.users
SET role = 'super_admin',
    updated_at = now()
WHERE lower(trim(email)) = 'rafael@clickhero.com.br';
