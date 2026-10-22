begin;
insert into auth.users(id,email) values ('88888888-8888-4888-8888-888888888888','chat-a@example.test'),('99999999-9999-4999-8999-999999999999','chat-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',true);
insert into public.ai_conversations(id,mode,title,source_language,target_language,messages) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','speaking','First meeting','en','es','[{"role":"model","text":"Hola"}]');
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
do $$ begin
 if(select count(*) from public.ai_conversations)<>0 then raise exception 'Cross-account chat read';end if;
 update public.ai_conversations set title='stolen' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 delete from public.ai_conversations where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 begin
 insert into public.ai_conversations(user_id,mode,title,source_language,target_language) values ('88888888-8888-4888-8888-888888888888','assistant','spoof','en','es');
 raise exception 'Cross-account chat insert';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.ai_conversations where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and title='First meeting') then raise exception 'Cross-account chat mutation';end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.ai_conversations;raise exception 'Anonymous chat read';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
