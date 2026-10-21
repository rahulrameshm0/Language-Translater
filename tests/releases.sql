begin;
insert into auth.users(id,email) values ('33333333-3333-4333-8333-333333333333','languages@example.test');
insert into public.translations(user_id,source_language,target_language,original_text,translated_text) values ('33333333-3333-4333-8333-333333333333','hy','de','Բարև','Hallo');
insert into public.app_releases(platform,version,build_number,download_url,notes) values ('android','1.1.0',3,'https://expo.dev/artifacts/eas/test.apk','Test fixture');
set local role anon;
do $$ begin
 if (select count(*) from public.app_releases where platform='android')<>1 then raise exception 'Public update discovery failed';end if;
 begin
 update public.app_releases set build_number=999;
 raise exception 'Anonymous update write allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$ begin
 if (select count(*) from public.translations where source_language='hy' and target_language='de')<>1 then raise exception 'New language history missing';end if;
 begin
 update public.app_releases set build_number=999;
 raise exception 'Authenticated update write allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
