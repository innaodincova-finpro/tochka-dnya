-- Tochka-only recovery extract.
-- Provenance: supabase/migrations/20260915140000_optimize_rls_and_foreign_keys.sql
-- Source SHA-256: 340af218a0d13ba2249bd991dc322f54379ea439419078aea5b90da2d892b212
-- Source commit: 23dcdde
--
-- The historical migration is intentionally not included by rebuild.sql because
-- it also alters public.app_data and creates indexes on Studkab tables.
-- Every statement below is the Tochka-owned subset of that migration.

alter policy tochka_access on public.user_app_data
  to authenticated
  using (exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  ))
  with check (exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  ));

create index if not exists push_deliveries_subscription_id_idx
  on public.push_deliveries (subscription_id);
create index if not exists tochka_assistant_deliveries_user_id_idx
  on public.tochka_assistant_deliveries (user_id);
create index if not exists tochka_telegram_reminder_config_owner_id_idx
  on public.tochka_telegram_reminder_config (owner_id);
