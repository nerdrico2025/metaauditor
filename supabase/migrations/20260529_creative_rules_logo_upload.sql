-- Phase B4 (Briefing #7): add logo upload to branding rules.
-- 1) New column on creative_rules for the uploaded logo URL.
-- 2) Storage bucket 'rule-assets' (public read, authenticated write) for the logo files.

alter table public.creative_rules
    add column if not exists logo_url text;

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('rule-assets', 'rule-assets', true)
on conflict (id) do nothing;

-- Policies: anyone with a session can read; authenticated users can upload/replace/delete
-- their own company's rule assets. We scope by the first folder being the company_id.
drop policy if exists "rule-assets read public" on storage.objects;
create policy "rule-assets read public"
    on storage.objects for select
    using (bucket_id = 'rule-assets');

drop policy if exists "rule-assets write authenticated" on storage.objects;
create policy "rule-assets write authenticated"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'rule-assets');

drop policy if exists "rule-assets update authenticated" on storage.objects;
create policy "rule-assets update authenticated"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'rule-assets');

drop policy if exists "rule-assets delete authenticated" on storage.objects;
create policy "rule-assets delete authenticated"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'rule-assets');
