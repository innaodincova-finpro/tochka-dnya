alter table public.tochka_assistant_pilot add column pending jsonb, add column pending_at timestamptz, add column current_update bigint;
alter table public.tochka_assistant_pilot add constraint pending_size check(pending is null or (jsonb_typeof(pending)='object' and octet_length(pending::text)<=12000));
create or replace function public.tochka_assistant_reserve(p_user uuid,p_update bigint) returns text
language plpgsql security invoker set search_path='' as $$
declare r public.tochka_assistant_pilot; d date := (now() at time zone 'Europe/Moscow')::date;
begin
 select * into r from public.tochka_assistant_pilot where user_id=p_user for update;
 if not found or not r.enabled then return 'disabled'; end if;
 if exists(select 1 from public.tochka_assistant_deliveries where update_id=p_update) then return 'duplicate'; end if;
 if exists(select 1 from public.tochka_assistant_deliveries where user_id=p_user and state='reserved' and created_at>now()-interval '90 seconds') then return 'busy'; end if;
 if r.day=d and r.used>=20 then return 'limit'; end if;
 insert into public.tochka_assistant_deliveries(update_id,user_id) values(p_update,p_user) on conflict do nothing;
 if not found then return 'duplicate'; end if;
 update public.tochka_assistant_pilot set current_update=p_update,day=d,used=case when day=d then used+1 else 1 end where user_id=p_user;
 return 'reserved';
end $$;
