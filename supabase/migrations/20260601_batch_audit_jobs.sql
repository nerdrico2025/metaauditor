create table if not exists public.batch_audit_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  total_candidates integer not null default 0,
  processed integer not null default 0,
  audited integer not null default 0,
  failed integer not null default 0,
  skipped_recent integer not null default 0,
  "offset" integer not null default 0,
  chunk_size integer not null default 25,
  analysis_mode text not null default 'balanced' check (analysis_mode in ('fast', 'balanced', 'full')),
  audit_focus text not null default 'performance' check (audit_focus in ('performance', 'branding')),
  campaign_id uuid null references public.campaigns(id) on delete set null,
  policy_id uuid null references public.policies(id) on delete set null,
  creative_ids text[] null,
  skip_recent_hours integer not null default 24,
  errors jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_batch_audit_jobs_company_created
  on public.batch_audit_jobs (company_id, created_at desc);

create index if not exists idx_batch_audit_jobs_status
  on public.batch_audit_jobs (status);

alter table public.batch_audit_jobs enable row level security;

drop policy if exists "Company users can read own batch jobs" on public.batch_audit_jobs;
create policy "Company users can read own batch jobs"
  on public.batch_audit_jobs
  for select
  using (
    company_id in (
      select u.company_id
      from public.users u
      where u.id = auth.uid()::text
    )
  );

drop policy if exists "Company users can create own batch jobs" on public.batch_audit_jobs;
create policy "Company users can create own batch jobs"
  on public.batch_audit_jobs
  for insert
  with check (
    company_id in (
      select u.company_id
      from public.users u
      where u.id = auth.uid()::text
    )
  );

drop policy if exists "Company users can update own batch jobs" on public.batch_audit_jobs;
create policy "Company users can update own batch jobs"
  on public.batch_audit_jobs
  for update
  using (
    company_id in (
      select u.company_id
      from public.users u
      where u.id = auth.uid()::text
    )
  );
