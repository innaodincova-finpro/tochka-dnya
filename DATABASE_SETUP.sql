-- «Точка дня» v4.0 — облачное хранение пользовательских данных
-- Выполняется один раз в SQL Editor проекта Supabase.

create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

grant select, insert, update, delete
on table public.user_app_data
to authenticated;

revoke all
on table public.user_app_data
from anon;

drop policy if exists "Users can read own app data" on public.user_app_data;
create policy "Users can read own app data"
on public.user_app_data for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own app data" on public.user_app_data;
create policy "Users can insert own app data"
on public.user_app_data for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own app data" on public.user_app_data;
create policy "Users can update own app data"
on public.user_app_data for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own app data" on public.user_app_data;
create policy "Users can delete own app data"
on public.user_app_data for delete
to authenticated
using ((select auth.uid()) = user_id);
