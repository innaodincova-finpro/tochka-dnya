-- Run in a transaction and roll back, including fixtures.
do $$
declare owner_id uuid; test_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid();
begin
 select id into owner_id from auth.users where lower(email)='inna_odincova@mail.ru';
 insert into auth.users(id,email,email_confirmed_at) values(test_id,test_id||'@example.invalid',now()),(other_id,other_id||'@example.invalid',now());
 insert into public.app_data(user_id,app,data) values(test_id,'kabinet','{"test":"preserve"}');
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 begin perform public.tochka_manage_access(test_id,test_id||'@example.invalid','grant');raise exception 'non-owner grant allowed';exception when insufficient_privilege then null;end;
 begin perform public.tochka_visit();raise exception 'other-app visit allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 begin perform public.tochka_manage_access(owner_id,'inna_odincova@mail.ru','remove');raise exception 'self removal allowed';exception when sqlstate 'P0001' then if sqlerrm='self removal allowed' then raise;end if;end;
 perform public.tochka_manage_access(test_id,test_id||'@example.invalid','grant');
 perform set_config('request.jwt.claim.sub',test_id::text,true);
 perform public.tochka_visit();
 if not exists(select 1 from public.tochka_members where user_id=test_id and last_seen_at is not null) then raise exception 'missing visit';end if;
 insert into public.user_app_data(user_id,payload) values(test_id,'{}');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.tochka_manage_access(test_id,test_id||'@example.invalid','remove');
 if exists(select 1 from public.user_app_data where user_id=test_id) then raise exception 'Tochka data retained';end if;
 if not exists(select 1 from public.app_data where user_id=test_id and data='{"test":"preserve"}') then raise exception 'other app changed';end if;
 if not exists(select 1 from auth.users where id=test_id) then raise exception 'shared Auth removed';end if;
 perform set_config('request.jwt.claim.sub',test_id::text,true);
 begin perform public.tochka_visit();raise exception 'revoked visit allowed';exception when insufficient_privilege then null;end;
 begin insert into public.user_app_data(user_id,payload) values(test_id,'{}');raise exception 'old tab recreated data';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.tochka_manage_access(test_id,test_id||'@example.invalid','grant');
 perform set_config('request.jwt.claim.sub',test_id::text,true);
 perform public.tochka_visit();
end $$;
