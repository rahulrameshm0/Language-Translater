create table public.translations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_language text not null check (source_language in ('en','es','ml')),
 target_language text not null check (target_language in ('en','es','ml')),
 original_text text not null check (char_length(original_text) between 1 and 5000),
 translated_text text not null,
 created_at timestamptz not null default now(),
 check (source_language <> target_language)
);
create index translations_user_date on public.translations(user_id, created_at desc, id desc);
alter table public.translations enable row level security;
revoke all on public.translations from anon, authenticated;
grant select, delete on public.translations to authenticated;
grant select, insert on public.translations to service_role;
create policy "Read own history" on public.translations for select to authenticated using ((select auth.uid()) = user_id);
create policy "Delete own history" on public.translations for delete to authenticated using ((select auth.uid()) = user_id);
create table public.translation_request_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null,
 requests integer not null
);
alter table public.translation_request_limits enable row level security;
revoke all on public.translation_request_limits from anon, authenticated;
create function public.consume_translation_request(request_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
 insert into public.translation_request_limits as limits(user_id, window_start, requests)
 values(request_user, date_trunc('minute', clock_timestamp()), 1)
 on conflict(user_id) do update set
 requests = case when limits.window_start = excluded.window_start then limits.requests + 1 else 1 end,
 window_start = excluded.window_start
 returning requests into used;
 return used <= 30;
end;
$$;
revoke all on function public.consume_translation_request(uuid) from public, anon, authenticated;
grant execute on function public.consume_translation_request(uuid) to service_role;
