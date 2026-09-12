create table if not exists public.tochka_assistant_confirmed (
 user_id uuid not null, version bigint not null, record_id text not null,
 kind text not null, proposal jsonb not null, before_payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(), primary key(user_id,version)
);
alter table public.tochka_assistant_confirmed enable row level security;
revoke all on public.tochka_assistant_confirmed from public,anon,authenticated;
grant select,insert on public.tochka_assistant_confirmed to service_role;
create or replace function public.tochka_assistant_confirm(p_user uuid,p_chat bigint,p_hook text,p_version bigint,p_action text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.tochka_assistant_pilot%rowtype; receipt public.tochka_assistant_confirmed%rowtype;
 old jsonb; result jsonb; rec jsonb; proposal jsonb; section text; rid text; moment timestamptz; old_time timestamptz;
begin
 select * into p from public.tochka_assistant_pilot where user_id=p_user for update;
 if not found or not p.enabled or p.hook_hash<>p_hook then raise exception 'owner_disabled'; end if;
 perform 1 from public.tochka_assistant_links where user_id=p_user and chat_id=p_chat for share;
 if not found then raise exception 'chat_not_linked'; end if;
 perform 1 from public.tochka_members where user_id=p_user and revoked_at is null for share;
 if not found then raise exception 'access_revoked'; end if;
 if p_action not in ('save','cancel') then raise exception 'invalid_action'; end if;
 select * into receipt from public.tochka_assistant_confirmed where user_id=p_user and version=p_version;
 if found then return jsonb_build_object('status','already_saved','kind',receipt.kind); end if;
 if p.pending is null or floor(extract(epoch from p.pending_at)*1000)::bigint<>p_version or p.pending_at<clock_timestamp()-interval '30 minutes' or p.pending_at<p.enabled_at then return jsonb_build_object('status','stale'); end if;
 if p_action='cancel' then
  update public.tochka_assistant_pilot set pending=null,pending_at=null where user_id=p_user;
  return jsonb_build_object('status','cancelled');
 end if;
 proposal=p.pending;
 if jsonb_typeof(proposal)<>'object' or coalesce(proposal->>'kind','') not in ('event','expense','note') or coalesce(length(proposal->>'title'),0) not between 1 and 1500 then raise exception 'invalid_proposal'; end if;
 if proposal->>'kind' in ('event','expense') then
  if coalesce(proposal->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or to_char((proposal->>'date')::date,'YYYY-MM-DD')<>proposal->>'date' then raise exception 'invalid_date'; end if;
 end if;
 if proposal->>'kind'='event' and coalesce(proposal->>'time','') !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'invalid_time'; end if;
 if proposal->>'kind'='expense' and (coalesce(jsonb_typeof(proposal->'amount'),'')<>'number' or (proposal->>'amount')::numeric<=0 or (proposal->>'amount')::numeric>1000000000 or round((proposal->>'amount')::numeric,2)<>(proposal->>'amount')::numeric or coalesce(proposal->>'currency','') not in ('RUB','AZN','KZT')) then raise exception 'invalid_expense'; end if;
 select payload,updated_at into old,old_time from public.user_app_data where user_id=p_user for update;
 if not found or jsonb_typeof(old)<>'object' then raise exception 'cloud_unavailable'; end if;
 section=case proposal->>'kind' when 'event' then 'ev' when 'expense' then 'exp' else 'notes' end;
 if coalesce(jsonb_typeof(old->section),'')<>'array' then raise exception 'invalid_cloud_section'; end if;
 rid='tg_'||replace(p_user::text,'-','')||'_'||p_version::text;
 if exists(select 1 from jsonb_array_elements(old->section) e where e->>'id'=rid) then raise exception 'unexpected_duplicate'; end if;
 if proposal->>'kind'='event' then rec=jsonb_build_object('id',rid,'title',proposal->>'title','date',proposal->>'date','time',proposal->>'time','address',coalesce(proposal->>'place',''),'plan',null,'kind','plain','repeat','none');
 elsif proposal->>'kind'='expense' then rec=jsonb_build_object('id',rid,'title',proposal->>'title','date',proposal->>'date','sum',proposal->'amount','cur',proposal->>'currency','cat','Прочее','src','Telegram');
 else rec=jsonb_build_object('id',rid,'text',proposal->>'title','date',to_char(clock_timestamp() at time zone 'Europe/Moscow','YYYY-MM-DD'),'kind','note','done',false); end if;
 moment=greatest(clock_timestamp(),old_time+interval '1 millisecond');
 result=jsonb_set(old,array[section],(old->section)||jsonb_build_array(rec));
 result=jsonb_set(result,'{savedAt}',to_jsonb(to_char(moment at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
 insert into public.tochka_assistant_confirmed(user_id,version,record_id,kind,proposal,before_payload) values(p_user,p_version,rid,proposal->>'kind',proposal,old);
 update public.user_app_data set payload=result,updated_at=moment where user_id=p_user;
 update public.tochka_assistant_pilot set pending=null,pending_at=null where user_id=p_user;
 return jsonb_build_object('status','saved','kind',proposal->>'kind');
end;
$$;
revoke all on function public.tochka_assistant_confirm(uuid,bigint,text,bigint,text) from public,anon,authenticated;
grant execute on function public.tochka_assistant_confirm(uuid,bigint,text,bigint,text) to service_role;
