create table public.tochka_assistant_actions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.tochka_assistant_pilot(user_id) on delete cascade,
 section text not null check(section in ('ev','notes','exp')),
 action text not null check(action in ('move','complete','delete')),
 original jsonb not null,
 target jsonb not null default '{}',
 state text not null default 'pending' check(state in ('pending','applied','cancelled')),
 created_at timestamptz not null default clock_timestamp(),
 before_payload jsonb
);
alter table public.tochka_assistant_actions enable row level security;
revoke all on public.tochka_assistant_actions from public,anon,authenticated;
grant select,insert,update on public.tochka_assistant_actions to service_role;
create index tochka_assistant_actions_owner on public.tochka_assistant_actions(user_id);
create function public.tochka_apply_assistant_action(p_user uuid,p_chat bigint,p_hook text,p_id uuid,p_cancel boolean)
returns text language plpgsql security invoker set search_path='' as $$
declare a public.tochka_assistant_actions%rowtype; old jsonb; rec jsonb; next jsonb; records jsonb; stamp timestamptz; oldstamp timestamptz; dayrow jsonb; today text;
begin
 perform 1 from public.tochka_assistant_pilot where user_id=p_user and enabled and hook_hash=p_hook for update;
 if not found then raise exception 'owner_disabled'; end if;
 perform 1 from public.tochka_assistant_links where user_id=p_user and chat_id=p_chat for share;
 if not found then raise exception 'not_linked'; end if;
 perform 1 from public.tochka_members where user_id=p_user and revoked_at is null for share;
 if not found then raise exception 'revoked'; end if;
 select * into a from public.tochka_assistant_actions where id=p_id and user_id=p_user for update;
 if not found then return 'stale'; end if;
 if a.state<>'pending' then return a.state; end if;
 if a.created_at<clock_timestamp()-interval '15 minutes' then return 'stale'; end if;
 if p_cancel then update public.tochka_assistant_actions set state='cancelled' where id=a.id;return 'cancelled';end if;
 select payload,updated_at into old,oldstamp from public.user_app_data where user_id=p_user for update;
 if not found or jsonb_typeof(old->a.section)<>'array' then raise exception 'cloud_unavailable';end if;
 select e into rec from jsonb_array_elements(old->a.section) e where e->>'id'=a.original->>'id';
 if not found or rec<>a.original or exists(select 1 from jsonb_array_elements(coalesce(old->'del','[]')) x where x->>'id'=rec->>'id') then return 'changed'; end if;
 stamp=greatest(clock_timestamp(),oldstamp+interval '1 millisecond');today=to_char(stamp at time zone 'Europe/Moscow','YYYY-MM-DD');next=old;
 if a.action='delete' then
  select coalesce(jsonb_agg(e order by ord),'[]') into records from jsonb_array_elements(old->a.section) with ordinality t(e,ord) where e->>'id'<>rec->>'id';
  next=jsonb_set(next,array[a.section],records);
  next=jsonb_set(next,'{del}',coalesce(next->'del','[]')||jsonb_build_array(jsonb_build_object('id',rec->>'id','at',stamp)));
 elsif a.action='move' then
  if a.section<>'ev' or coalesce(rec->>'repeat','none') not in ('none','') then raise exception 'unsupported';end if;
  if coalesce(a.target->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char((a.target->>'date')::date,'YYYY-MM-DD')<>a.target->>'date' or coalesce(a.target->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'invalid_target'; end if;
  rec=rec||jsonb_build_object('date',a.target->>'date','time',a.target->>'time');
  select jsonb_agg(case when e->>'id'=rec->>'id' then rec else e end order by ord) into records from jsonb_array_elements(old->a.section) with ordinality t(e,ord);
  next=jsonb_set(next,array[a.section],records);
  dayrow=old->'day'->(a.original->>'date');
  if dayrow is not null then
   select coalesce(jsonb_agg(v),'[]') into records from jsonb_array_elements(coalesce(dayrow->'done','[]')) v where v<>to_jsonb(rec->>'id');
   next=jsonb_set(next,array['day',a.original->>'date'],jsonb_set(dayrow,'{done}',records));
  end if;
 elsif a.action='complete' then
  if a.section='notes' and rec->'items' is null then
   rec=rec||jsonb_build_object('kind','task','done',true,'completedAt',today);
   select jsonb_agg(case when e->>'id'=rec->>'id' then rec else e end order by ord) into records from jsonb_array_elements(old->a.section) with ordinality t(e,ord);
   next=jsonb_set(next,array[a.section],records);
  elsif a.section='ev' and coalesce(rec->>'repeat','none') in ('none','') then
   next=jsonb_set(next,'{day}',coalesce(next->'day','{}'));
   dayrow=coalesce(next->'day'->(rec->>'date'),'{}');records=coalesce(dayrow->'done','[]');
   if not records ? (rec->>'id') then records=records||jsonb_build_array(rec->>'id');end if;
   next=jsonb_set(next,array['day',rec->>'date'],jsonb_set(dayrow,'{done}',records));
  else raise exception 'unsupported';end if;
 else raise exception 'invalid_action';end if;
 next=jsonb_set(next,'{savedAt}',to_jsonb(to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
 update public.user_app_data set payload=next,updated_at=stamp where user_id=p_user;
 update public.tochka_assistant_actions set state='applied',before_payload=old where id=a.id;
 return 'applied';
end $$;
revoke all on function public.tochka_apply_assistant_action(uuid,bigint,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.tochka_apply_assistant_action(uuid,bigint,text,uuid,boolean) to service_role;
