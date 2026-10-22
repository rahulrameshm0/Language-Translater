create table public.ai_conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 mode text not null check(mode in ('assistant','speaking')),
 title text not null check(char_length(title) between 1 and 100),
 source_language text not null, target_language text not null,
 messages jsonb not null default '[]' check(jsonb_typeof(messages)='array' and jsonb_array_length(messages)<=32 and octet_length(messages::text)<=100000),
 updated_at timestamptz not null default now()
);
alter table public.ai_conversations enable row level security;
revoke all on public.ai_conversations from anon,authenticated;
grant select,insert,update,delete on public.ai_conversations to authenticated;
create policy "Own AI conversations" on public.ai_conversations for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index ai_conversations_owner_date on public.ai_conversations(user_id,updated_at desc);
