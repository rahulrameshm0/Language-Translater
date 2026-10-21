-- Retain ml in database constraints so existing saved history remains readable.
alter table public.translations drop constraint translations_source_language_check;
alter table public.translations add constraint translations_source_language_check check (source_language in ('en','es','ml','hy','de'));
alter table public.translations drop constraint translations_target_language_check;
alter table public.translations add constraint translations_target_language_check check (target_language in ('en','es','ml','hy','de'));
create table public.app_releases (
 platform text primary key check (platform in ('android','ios')),
 version text not null,
 build_number integer not null check (build_number > 0),
 download_url text not null check (download_url ~ '^https://'),
 notes text not null default '',
 published_at timestamptz not null default now()
);
alter table public.app_releases enable row level security;
revoke all on public.app_releases from anon, authenticated;
grant select on public.app_releases to anon, authenticated;
grant all on public.app_releases to service_role;
create policy "Read published app releases" on public.app_releases for select to anon, authenticated using (true);
