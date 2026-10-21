-- Run against local Supabase: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database.sql
begin;
insert into auth.users(id, email) values
 ('11111111-1111-4111-8111-111111111111','alice@example.test'),
 ('22222222-2222-4222-8222-222222222222','bob@example.test');
insert into public.translations(user_id,source_language,target_language,original_text,translated_text) values
 ('11111111-1111-4111-8111-111111111111','en','ml','Hello','നമസ്കാരം'),
 ('22222222-2222-4222-8222-222222222222','es','en','Hola','Hello');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
 if (select count(*) from public.translations) <> 1 then raise exception 'History isolation failed'; end if;
 delete from public.translations where user_id='22222222-2222-4222-8222-222222222222';
 if found then raise exception 'Cross-account deletion allowed'; end if;
 delete from public.translations where user_id='11111111-1111-4111-8111-111111111111';
 if not found then raise exception 'Own history deletion failed'; end if;
 begin
 insert into public.translations(user_id,source_language,target_language,original_text,translated_text)
 values('11111111-1111-4111-8111-111111111111','en','ml','Hello','Hi');
 raise exception 'Client insert must be denied';
 exception when insufficient_privilege then null;
 end;
 begin
 perform public.consume_translation_request('11111111-1111-4111-8111-111111111111');
 raise exception 'Client rate-limit access must be denied';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
do $$ begin
 for i in 1..30 loop
 if not public.consume_translation_request('11111111-1111-4111-8111-111111111111') then raise exception 'Request rejected too early'; end if;
 end loop;
 if public.consume_translation_request('11111111-1111-4111-8111-111111111111') then raise exception 'Request 31 allowed'; end if;
end $$;
rollback;
