begin;
insert into auth.users(id,email) values ('55555555-5555-4555-8555-555555555555','learner-a@example.test'),('66666666-6666-4666-8666-666666666666','learner-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
insert into public.study_settings(user_id,daily_goal,time_zone) values ('55555555-5555-4555-8555-555555555555',10,'Asia/Kolkata');
insert into public.learning_cards(id,user_id,source_language,target_language,source_text,translation) values ('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','en','es','Hello','Hola');
select public.review_learning_card('77777777-7777-4777-8777-777777777777','good');
do $$ begin
 if (select review_count from public.learning_cards where id='77777777-7777-4777-8777-777777777777')<>1 then raise exception 'Review not saved';end if;
 if (select due_at from public.learning_cards where id='77777777-7777-4777-8777-777777777777')<=now() then raise exception 'Review not scheduled';end if;
 if (select count(*) from public.learning_reviews)<>1 then raise exception 'Progress not saved';end if;
 begin
  update public.learning_cards set review_count=999;
  raise exception 'Client scheduling write allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.learning_reviews(user_id,card_id,review_date,grade) values ('55555555-5555-4555-8555-555555555555','77777777-7777-4777-8777-777777777777',current_date,'easy');
  raise exception 'Client review forgery allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.learning_cards(user_id,source_language,target_language,source_text,translation) values ('66666666-6666-4666-8666-666666666666','en','es','Bad','Mal');
  raise exception 'Cross-account insert allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
insert into public.speaking_attempts(user_id,target_language,prompt_text,heard_text,matched_words,total_words) values ('55555555-5555-4555-8555-555555555555','es','Hola','Hola',1,1);
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
do $$ begin
 if (select count(*) from public.learning_cards)<>0 or (select count(*) from public.study_settings)<>0 or (select count(*) from public.learning_reviews)<>0 or (select count(*) from public.speaking_attempts)<>0 then raise exception 'Cross-account read allowed';end if;
 delete from public.learning_cards where id='77777777-7777-4777-8777-777777777777';
 begin
  perform public.review_learning_card('77777777-7777-4777-8777-777777777777','easy');
  raise exception 'Cross-account review allowed';
 exception when raise_exception then if sqlerrm <> 'Card not found' then raise;end if;
 end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.learning_cards where id='77777777-7777-4777-8777-777777777777')<>1 then raise exception 'Cross-account delete allowed';end if;
end $$;
set local role anon;
do $$ begin
 begin
  perform public.review_learning_card('77777777-7777-4777-8777-777777777777','good');
  raise exception 'Anonymous review allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
