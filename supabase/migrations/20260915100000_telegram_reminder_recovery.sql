-- Keep reminders recoverable after short outages and make uncertain deliveries visible.
alter table public.tochka_telegram_reminder_deliveries
 drop constraint if exists tochka_telegram_reminder_deliveries_state_check;
alter table public.tochka_telegram_reminder_deliveries
 add constraint tochka_telegram_reminder_deliveries_state_check
 check(state in ('claimed','sent','retry','unknown','alerted','skipped'));

create or replace function public.tochka_claim_telegram_reminder(p_user uuid,p_chat bigint,p_key text,p_event jsonb,p_date text)
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
 if p_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(p_event->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return null; end if;
 if p_date < p_event->>'date' then return null; end if;
 if p_date <> p_event->>'date' and not coalesce(case p_event->>'repeat'
  when 'week' then ((p_date::date-(p_event->>'date')::date)%7=0)
  when 'month' then right(p_date,2)=right(p_event->>'date',2)
  when 'year' then right(p_date,5)=right(p_event->>'date',5)
  else false end,false) then return null; end if;
 at_time=(p_date||'T'||(p_event->>'time')||':00+03:00')::timestamptz;
 if clock_timestamp()<at_time-interval '1 hour' or clock_timestamp()>=at_time+interval '5 hours' then return null; end if;
 if p_key <> 'event:'||(p_event->>'id')||':'||p_date||':'||(p_event->>'time')||':1h:MSK' then return null; end if;
 insert into public.tochka_telegram_reminder_deliveries as d(user_id,key) values(p_user,p_key)
 on conflict(user_id,key) do update set claim_id=gen_random_uuid(),state='claimed',attempts=d.attempts+1,retry_at=null
 where d.state='retry' and d.retry_at<=clock_timestamp() and d.attempts<3
 returning claim_id into token;
 return token;
end $$;
revoke all on function public.tochka_claim_telegram_reminder(uuid,bigint,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.tochka_claim_telegram_reminder(uuid,bigint,text,jsonb,text) to service_role;
