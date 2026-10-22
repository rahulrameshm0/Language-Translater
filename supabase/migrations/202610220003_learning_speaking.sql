create table public.learning_cards (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 source_language text not null check(source_language in ('en','es','hy','de','fr','it','pt','ru','uk','pl','nl','sv','no','da','fi','el','tr','ar','he','fa','hi','bn','ta','te','kn','ja','ko','zh','id','vi')),
 target_language text not null check(target_language in ('en','es','hy','de','fr','it','pt','ru','uk','pl','nl','sv','no','da','fi','el','tr','ar','he','fa','hi','bn','ta','te','kn','ja','ko','zh','id','vi')),
 source_text text not null check (char_length(source_text) between 1 and 300),
 translation text not null check (char_length(translation) between 1 and 300),
 created_at timestamptz not null default now(),
 due_at timestamptz not null default now(),
 last_reviewed_at timestamptz,
 review_count integer not null default 0 check (review_count>=0),
 known_count integer not null default 0 check (known_count>=0),
 check(source_language<>target_language),
 unique(user_id,source_language,target_language,source_text,translation)
);
create index learning_due on public.learning_cards(user_id,due_at,id);
alter table public.learning_cards enable row level security;
revoke all on public.learning_cards from anon,authenticated;
grant select,delete on public.learning_cards to authenticated;
grant insert(id,user_id,source_language,target_language,source_text,translation) on public.learning_cards to authenticated;
grant update(source_text,translation) on public.learning_cards to authenticated;
create policy "Own learning cards" on public.learning_cards for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create table public.study_settings (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 daily_goal integer not null default 5 check (daily_goal in (5,10,20)),
 time_zone text not null default 'UTC' check(char_length(time_zone)<=100)
);
alter table public.study_settings enable row level security;
revoke all on public.study_settings from anon,authenticated;
grant select,insert,update on public.study_settings to authenticated;
create policy "Own study settings" on public.study_settings for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create table public.learning_reviews (
 user_id uuid not null references auth.users(id) on delete cascade,
 card_id uuid not null references public.learning_cards(id) on delete cascade,
 review_date date not null,
 grade text not null check(grade in ('again','good','easy')),
 reviewed_at timestamptz not null default now(),
 primary key(user_id,card_id,review_date)
);
alter table public.learning_reviews enable row level security;
revoke all on public.learning_reviews from anon,authenticated;
grant select on public.learning_reviews to authenticated;
create policy "Own learning reviews" on public.learning_reviews for select to authenticated using ((select auth.uid())=user_id);
create function public.review_learning_card(card uuid, rating text) returns void language plpgsql security definer set search_path='' as $$
declare item public.learning_cards; zone text; day date; delay_days integer;
begin
 if auth.uid() is null or rating is null or rating not in ('again','good','easy') then raise exception 'Invalid review'; end if;
 select * into item from public.learning_cards where id=card and user_id=auth.uid() for update;
 if not found then raise exception 'Card not found'; end if;
 if item.last_reviewed_at > now()-interval '5 seconds' then raise exception 'This card was just reviewed. Try another card.'; end if;
 select time_zone into zone from public.study_settings where user_id=auth.uid();
 if zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone:='UTC';end if;
 day:=timezone(zone,now())::date;
 delay_days:=least(30,case when rating='easy' then 4 else 1 end * greatest(1,item.known_count+1));
 update public.learning_cards set review_count=review_count+1, known_count=known_count+case when rating='again' then 0 else 1 end,
 last_reviewed_at=now(), due_at=case when rating='again' then now()+interval '10 minutes' else now()+make_interval(days=>delay_days) end where id=card and user_id=auth.uid();
 insert into public.learning_reviews(user_id,card_id,review_date,grade) values(auth.uid(),card,day,rating)
 on conflict(user_id,card_id,review_date) do update set grade=excluded.grade,reviewed_at=now();
end;
$$;
revoke all on function public.review_learning_card(uuid,text) from public,anon;
grant execute on function public.review_learning_card(uuid,text) to authenticated;
create table public.speaking_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 target_language text not null check(target_language in ('en','es','hy','de','fr','it','pt','ru','uk','pl','nl','sv','no','da','fi','el','tr','ar','he','fa','hi','bn','ta','te','kn','ja','ko','zh','id','vi')),
 prompt_text text not null check(char_length(prompt_text) between 1 and 500),
 heard_text text not null check(char_length(heard_text) between 1 and 1000),
 matched_words integer not null check(matched_words>=0),
 total_words integer not null check(total_words>0 and matched_words<=total_words),
 created_at timestamptz not null default now()
);
alter table public.speaking_attempts enable row level security;
revoke all on public.speaking_attempts from anon,authenticated;
grant select,delete on public.speaking_attempts to authenticated;
grant insert(user_id,target_language,prompt_text,heard_text,matched_words,total_words) on public.speaking_attempts to authenticated;
create policy "Own speaking attempts" on public.speaking_attempts for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
