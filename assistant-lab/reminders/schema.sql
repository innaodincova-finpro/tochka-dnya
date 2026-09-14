-- Additive, service-only reminder state. No writes to application records.
create table public.tochka_telegram_reminder_config (
 id integer primary key check(id=1),
 owner_id uuid references public.tochka_assistant_pilot(user_id),
 enabled boolean not null default false,
 cron_token text not null default (gen_random_uuid()::text||gen_random_uuid()::text),
 last_run_at timestamptz,
 last_result jsonb
);
insert into public.tochka_telegram_reminder_config(id) values(1);
create table public.tochka_telegram_reminder_deliveries (
 user_id uuid not null references public.tochka_assistant_pilot(user_id) on delete cascade,
 key text not null,
 claim_id uuid not null default gen_random_uuid(),
 state text not null default 'claimed' check(state in ('claimed','sent','retry','unknown','skipped')),
 attempts integer not null default 1 check(attempts between 1 and 3),
 created_at timestamptz not null default clock_timestamp(),
 retry_at timestamptz,
 sent_at timestamptz,
 primary key(user_id,key)
);
alter table public.tochka_telegram_reminder_config enable row level security;
alter table public.tochka_telegram_reminder_deliveries enable row level security;
revoke all on public.tochka_telegram_reminder_config,public.tochka_telegram_reminder_deliveries from public,anon,authenticated;
grant select,update on public.tochka_telegram_reminder_config to service_role;
grant select,insert,update on public.tochka_telegram_reminder_deliveries to service_role;

create function public.tochka_claim_telegram_reminder(p_user uuid,p_chat bigint,p_key text,p_event jsonb,p_date text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare current_payload jsonb; token uuid; at_time timestamptz;
begin
 perform 1 from public.tochka_telegram_reminder_config where id=1 and enabled and owner_id=p_user for share;
 if not found then return null; end if;
 perform 1 from public.tochka_assistant_pilot where user_id=p_user and enabled for share;
 if not found then return null; end if;
 perform 1 from public.tochka_assistant_links where user_id=p_user and chat_id=p_chat for share;
 if not found then return null; end if;
 perform 1 from public.tochka_members where user_id=p_user and revoked_at is null for share;
 if not found then return null; end if;
 select payload into current_payload from public.user_app_data where user_id=p_user for share;
 if not found or jsonb_typeof(current_payload->'ev')<>'array' then return null; end if;
 if not exists(select 1 from jsonb_array_elements(current_payload->'ev') e where e=p_event) then return null; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(current_payload->'del','[]')) e where e->>'id'=p_event->>'id') then return null; end if;
 if coalesce(current_payload->'day'->p_date->'done','[]') ? (p_event->>'id') then return null; end if;
 -- The RPC rechecks time and recurrence; caller cannot reserve stale/incorrect keys.
 if p_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(p_event->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return null; end if;
 if p_date < p_event->>'date' then return null; end if;
 if p_date <> p_event->>'date' and not coalesce(case p_event->>'repeat'
  when 'week' then ((p_date::date-(p_event->>'date')::date)%7=0)
  when 'month' then right(p_date,2)=right(p_event->>'date',2)
  when 'year' then right(p_date,5)=right(p_event->>'date',5)
  else false end,false) then return null; end if;
 at_time=(p_date||'T'||(p_event->>'time')||':00+03:00')::timestamptz;
 if clock_timestamp()<at_time-interval '1 hour' or clock_timestamp()>=at_time-interval '55 minutes' then return null; end if;
 if p_key <> 'event:'||(p_event->>'id')||':'||p_date||':'||(p_event->>'time')||':1h:MSK' then return null; end if;
 insert into public.tochka_telegram_reminder_deliveries as d(user_id,key) values(p_user,p_key)
 on conflict(user_id,key) do update set claim_id=gen_random_uuid(),state='claimed',attempts=d.attempts+1,retry_at=null
 where d.state='retry' and d.retry_at<=clock_timestamp() and d.attempts<3
 returning claim_id into token;
 return token;
end $$;
revoke all on function public.tochka_claim_telegram_reminder(uuid,bigint,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.tochka_claim_telegram_reminder(uuid,bigint,text,jsonb,text) to service_role;
