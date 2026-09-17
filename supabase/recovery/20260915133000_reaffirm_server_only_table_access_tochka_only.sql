-- Tochka-only recovery extract.
-- Provenance: supabase/migrations/20260915133000_reaffirm_server_only_table_access.sql
-- Source SHA-256: df1d0b7574affffe6a6a0d81bb08cd4d6c1c991d26cb0c9ee2a675cbc0234d75
-- Source commit: 23dcdde
--
-- The historical migration is intentionally not included by rebuild.sql because
-- it also references Studkab tables that do not exist in a Tochka-only project.
-- Every statement below is the Tochka-owned subset of that migration.

revoke all on table
  public.push_configuration,
  public.push_deliveries,
  public.push_subscriptions,
  public.tochka_assistant_actions,
  public.tochka_assistant_confirmed,
  public.tochka_assistant_deliveries,
  public.tochka_assistant_links,
  public.tochka_assistant_pilot,
  public.tochka_assistant_sandbox,
  public.tochka_telegram_reminder_config,
  public.tochka_telegram_reminder_deliveries
from public, anon, authenticated;
