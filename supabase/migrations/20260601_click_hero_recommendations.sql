-- Persisted Click Hero recommendations from creative audits and account/campaign analysis.

create table if not exists public.click_hero_recommendations (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete cascade,
    source_type text not null check (source_type in ('creative_audit', 'account_analysis', 'campaign_analysis')),
    creative_id uuid references public.creatives(id) on delete set null,
    campaign_id uuid references public.campaigns(id) on delete set null,
    audit_id uuid references public.audits(id) on delete set null,
    priority text not null check (priority in ('high', 'medium', 'low')),
    category text not null check (category in ('scaling', 'creative', 'audience', 'budget', 'branding', 'tracking', 'performance')),
    title text not null,
    rationale text not null default '',
    next_step text not null default '',
    status text not null default 'open' check (status in ('open', 'dismissed', 'done')),
    created_at timestamptz not null default now()
);

create index if not exists idx_chr_company_status on public.click_hero_recommendations(company_id, status, created_at desc);
create index if not exists idx_chr_creative on public.click_hero_recommendations(creative_id) where creative_id is not null;
create index if not exists idx_chr_audit on public.click_hero_recommendations(audit_id) where audit_id is not null;

alter table public.click_hero_recommendations enable row level security;

drop policy if exists "chr_user_scope" on public.click_hero_recommendations;
drop policy if exists "chr_service_role" on public.click_hero_recommendations;

create policy "chr_user_scope" on public.click_hero_recommendations for all
using (
    public.is_super_admin()
    or (
        public.same_company(click_hero_recommendations.company_id)
        and (
            click_hero_recommendations.creative_id is null
            or public.user_can_see_creative(click_hero_recommendations.creative_id)
        )
    )
);

create policy "chr_service_role" on public.click_hero_recommendations for all
using (auth.role() = 'service_role');
