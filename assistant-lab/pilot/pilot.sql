create table public.tochka_assistant_pilot (
 user_id uuid primary key references public.tochka_assistant_links(user_id) on delete cascade,
 enabled boolean not null default false,
 hook_hash text not null check(hook_hash ~ '^[a-f0-9]{64}$'),
 enabled_at timestamptz not null default now(),
 day date not null default current_date,
 used integer not null default 0 check(used between 0 and 20)
);
create table public.tochka_assistant_deliveries (
 update_id bigint primary key,
 user_id uuid not null references public.tochka_assistant_pilot(user_id) on delete cascade,
 created_at timestamptz not null default now(),
 state text not null default 'reserved' check(state in ('reserved','sent','failed'))
);
alter table public.tochka_assistant_pilot enable row level security;
alter table public.tochka_assistant_deliveries enable row level security;
revoke all on public.tochka_assistant_pilot,public.tochka_assistant_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.tochka_assistant_pilot,public.tochka_assistant_deliveries to service_role;
create function public.tochka_assistant_reserve(p_user uuid,p_update bigint) returns text
language plpgsql security invoker set search_path='' as $$
declare r public.tochka_assistant_pilot; d date := (now() at time zone 'Europe/Moscow')::date;
begin
 select * into r from public.tochka_assistant_pilot where user_id=p_user for update;
 if not found or not r.enabled then return 'disabled'; end if;
 if exists(select 1 from public.tochka_assistant_deliveries where update_id=p_update) then return 'duplicate'; end if;
 if r.day=d and r.used>=20 then return 'limit'; end if;
 insert into public.tochka_assistant_deliveries(update_id,user_id) values(p_update,p_user) on conflict do nothing;
 if not found then return 'duplicate'; end if;
 update public.tochka_assistant_pilot set day=d,used=case when day=d then used+1 else 1 end where user_id=p_user;
 return 'reserved';
end $$;
revoke all on function public.tochka_assistant_reserve(uuid,bigint) from public,anon,authenticated;
grant execute on function public.tochka_assistant_reserve(uuid,bigint) to service_role;
