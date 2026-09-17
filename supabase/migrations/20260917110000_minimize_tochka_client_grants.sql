-- Browser roles receive only the table privileges used by the Tochka client.
-- RLS remains the row-level boundary; this migration narrows the object-level
-- surface and is safe to run repeatedly.
begin;

revoke all privileges on table
  public.user_app_data,
  public.tochka_documents,
  public.tochka_members
from public, anon, authenticated;

grant select, insert, update, delete
on table public.user_app_data, public.tochka_documents
to authenticated;

grant select on table public.tochka_members to authenticated;
grant update(last_seen_at) on table public.tochka_members to authenticated;

commit;
