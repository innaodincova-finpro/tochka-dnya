-- Access management is an internal server operation. Signed-in browsers must
-- never be able to call it directly, and the owner's email stays out of SQL.
create or replace function public.tochka_manage_access(p_user_id uuid, p_email text, p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
 if p_action not in ('grant','remove') or p_action is null then
   raise exception 'Неизвестное действие' using errcode='P0001';
 end if;
 perform 1 from auth.users where id=p_user_id and lower(email)=lower(trim(p_email)) for update;
 if not found then
   raise exception 'Пользователь изменился. Обновите список.' using errcode='P0001';
 end if;
 if p_action='grant' then
   insert into public.tochka_members(user_id,invited_at) values(p_user_id,clock_timestamp())
   on conflict(user_id) do update set invited_at=excluded.invited_at,revoked_at=null;
 else
   perform 1 from public.tochka_members where user_id=p_user_id and revoked_at is null for update;
   if not found then raise exception 'Запись уже удалена. Обновите список.' using errcode='P0001'; end if;
   update public.tochka_members set revoked_at=clock_timestamp(),last_seen_at=null where user_id=p_user_id;
   delete from public.push_subscriptions where user_id=p_user_id;
   delete from public.user_app_data where user_id=p_user_id;
 end if;
 return true;
end
$$;

revoke all on function public.tochka_manage_access(uuid,text,text) from public, anon, authenticated;
grant execute on function public.tochka_manage_access(uuid,text,text) to service_role;

-- A user may update only their own last_seen_at column. This removes the need
-- for elevated rights in the ordinary visit heartbeat.
drop policy if exists own_last_seen_update on public.tochka_members;
create policy own_last_seen_update on public.tochka_members
for update to authenticated
using (user_id = (select auth.uid()) and revoked_at is null)
with check (user_id = (select auth.uid()) and revoked_at is null);

revoke update on public.tochka_members from authenticated;
grant update(last_seen_at) on public.tochka_members to authenticated;

create or replace function public.tochka_visit()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
 update public.tochka_members set last_seen_at=clock_timestamp()
 where user_id=(select auth.uid()) and revoked_at is null;
 if not found then
   raise exception 'Доступ к облаку «Точки дня» закрыт. Обратитесь к Инне.' using errcode='42501';
 end if;
 return true;
end
$$;

revoke all on function public.tochka_visit() from public, anon;
grant execute on function public.tochka_visit() to authenticated, service_role;
