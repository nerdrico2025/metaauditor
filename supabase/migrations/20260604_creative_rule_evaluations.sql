-- Per-rule evaluation cache for incremental branding/performance analysis.

create table if not exists public.creative_rule_evaluations (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete cascade,
    creative_id uuid not null references public.creatives(id) on delete cascade,
    rule_id uuid not null,
    rule_kind text not null check (rule_kind in ('branding', 'performance')),
    passed boolean not null default false,
    reason text not null default '',
    severity text null,
    result_json jsonb not null default '{}'::jsonb,
    input_fingerprint text not null,
    evaluated_at timestamptz not null default now(),
    unique (creative_id, rule_id, rule_kind)
);

create index if not exists idx_cre_company_creative
    on public.creative_rule_evaluations (company_id, creative_id);

create index if not exists idx_cre_creative_kind
    on public.creative_rule_evaluations (creative_id, rule_kind);

create index if not exists idx_cre_rule
    on public.creative_rule_evaluations (rule_id, rule_kind);

alter table public.creative_rule_evaluations enable row level security;

drop policy if exists "cre_user_scope" on public.creative_rule_evaluations;
drop policy if exists "cre_service_role" on public.creative_rule_evaluations;

create policy "cre_user_scope" on public.creative_rule_evaluations for all
using (
    public.is_super_admin()
    or (
        public.same_company(creative_rule_evaluations.company_id)
        and public.user_can_see_creative(creative_rule_evaluations.creative_id)
    )
);

create policy "cre_service_role" on public.creative_rule_evaluations for all
using (auth.role() = 'service_role');

-- Batch job counters for incremental cache stats
alter table public.batch_audit_jobs
    add column if not exists skipped_cached integer not null default 0;

alter table public.batch_audit_jobs
    add column if not exists evaluated_delta integer not null default 0;

alter table public.batch_audit_jobs
    add column if not exists full_rerun integer not null default 0;
