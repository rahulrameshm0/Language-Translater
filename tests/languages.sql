begin;
insert into auth.users(id,email) values ('44444444-4444-4444-8444-444444444444','catalog@example.test');
do $$ declare code text; begin
 foreach code in array array['en','es','hy','de','fr','it','pt','ru','uk','pl','nl','sv','no','da','fi','el','tr','ar','he','fa','hi','bn','ta','te','kn','ja','ko','zh','id','vi'] loop
  if code <> 'en' then
   insert into public.translations(user_id,source_language,target_language,original_text,translated_text) values ('44444444-4444-4444-8444-444444444444','en',code,'Hello','Language test'),('44444444-4444-4444-8444-444444444444',code,'en','Language test','Hello');
  end if;
 end loop;
end $$;
insert into public.translations(user_id,source_language,target_language,original_text,translated_text,input_kind,source_name) values ('44444444-4444-4444-8444-444444444444','en','es','Hello','Hola','call','Call.m4a');
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$ begin
 if (select count(*) from public.translations)<>59 then raise exception '30-language history persistence failed'; end if;
end $$;
reset role;
rollback;
