-- Phase D3 (briefing #10): persistent log of sync failures so the cron run can
-- surface problems even when no human is watching the UI. The cron edge function
-- writes one row per failed integration; an alert worker (or a future trigger
-- on this table) can email/WhatsApp the admin (Rafael).
--
-- Read access is restricted to platform admins. Write goes through service_role.

create table if not exists public.sync_errors (
    id uuid primary key default gen_random_uuid(),
    integration_id uuid references public.integrations(id) on delete cascade,
    company_id uuid references public.companies(id) on delete cascade,
    error_message text not null,
    error_code text,
    failed_at timestamptz not null default now(),
    notified boolean not null default false,
    notified_at timestamptz
);

create index if not exists idx_sync_errors_company on public.sync_errors(company_id, failed_at desc);
create index if not exists idx_sync_errors_pending on public.sync_errors(notified) where notified = false;

alter table public.sync_errors enable row level security;

drop policy if exists "sync_errors admin read" on public.sync_errors;
create policy "sync_errors admin read"
    on public.sync_errors for select
    using (
        exists (
            select 1 from public.users p
            where p.id = auth.uid()::text
              and p.role in ('company_admin', 'super_admin')
              and (p.company_id = sync_errors.company_id or p.role = 'super_admin')
        )
    );

-- service_role bypasses RLS, so the edge function can insert/update without
-- additional policies. No INSERT/UPDATE policy is exposed to clients on purpose.
