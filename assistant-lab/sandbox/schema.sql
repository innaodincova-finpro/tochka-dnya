create table public.tochka_assistant_sandbox (
 user_id uuid not null references public.tochka_assistant_pilot(user_id) on delete cascade,
 source_version timestamptz not null,
 proposal jsonb not null check(jsonb_typeof(proposal)='object' and octet_length(proposal::text)<=12000),
 created_at timestamptz not null default now(),
 primary key(user_id,source_version)
);
alter table public.tochka_assistant_sandbox enable row level security;
revoke all on public.tochka_assistant_sandbox from public,anon,authenticated;
grant select,insert,delete on public.tochka_assistant_sandbox to service_role;
create function public.tochka_assistant_sandbox_confirm(p_user uuid,p_version timestamptz,p_expected jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.tochka_assistant_pilot; saved public.tochka_assistant_sandbox;
begin
 select * into p from public.tochka_assistant_pilot where user_id=p_user for update;
 if not found or not p.enabled then return jsonb_build_object('error','disabled'); end if;
 select * into saved from public.tochka_assistant_sandbox where user_id=p_user and source_version=p_version;
 if found then return jsonb_build_object('saved',true,'duplicate',true); end if;
 if p.pending_at is distinct from p_version or p.pending is distinct from p_expected then return jsonb_build_object('error','draft_changed'); end if;
 if p.pending is null or p.pending_at<now()-interval '30 minutes' or p.pending_at<p.enabled_at then return jsonb_build_object('error','draft_expired'); end if;
 if coalesce(p.pending->>'kind','') not in ('event','expense','note') or coalesce(length(trim(p.pending->>'title')),0)=0 then return jsonb_build_object('error','invalid_draft'); end if;
 if p.pending->>'kind'='event' and (coalesce(p.pending->>'date','')='' or coalesce(p.pending->>'time','')='') then return jsonb_build_object('error','incomplete'); end if;
 if p.pending->>'kind'='expense' and (coalesce(p.pending->>'date','')='' or coalesce(p.pending->>'currency','')='' or p.pending->'amount' is null or p.pending->'amount'='null'::jsonb) then return jsonb_build_object('error','incomplete'); end if;
 insert into public.tochka_assistant_sandbox(user_id,source_version,proposal) values(p_user,p_version,p.pending);
 return jsonb_build_object('saved',true,'duplicate',false);
end $$;
revoke all on function public.tochka_assistant_sandbox_confirm(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.tochka_assistant_sandbox_confirm(uuid,timestamptz,jsonb) to service_role;
